from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
from werkzeug.utils import secure_filename
import PyPDF2
import docx
import google.generativeai as genai
import re
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'doc', 'docx'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Create upload directory if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Configure Gemini API
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
genai.configure(api_key=GEMINI_API_KEY)

# Initialize Gemini model
model = genai.GenerativeModel('gemini-1.5-flash')

# Job profiles data
JOB_PROFILES = {
    "software_engineer": {
        "name": "Software Engineer",
        "required_skills": ["python", "java", "javascript", "react", "node.js", "sql", "git", "api", "database", "web development"],
        "preferred_skills": ["docker", "kubernetes", "aws", "microservices", "agile", "scrum", "testing", "ci/cd"],
        "experience_keywords": ["developed", "built", "implemented", "designed", "created", "maintained", "optimized"],
        "education_keywords": ["computer science", "software engineering", "information technology", "programming"]
    },
    "data_scientist": {
        "name": "Data Scientist",
        "required_skills": ["python", "r", "machine learning", "statistics", "sql", "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch"],
        "preferred_skills": ["deep learning", "nlp", "computer vision", "big data", "spark", "hadoop", "tableau", "power bi"],
        "experience_keywords": ["analyzed", "modeled", "predicted", "visualized", "researched", "experimented"],
        "education_keywords": ["data science", "statistics", "mathematics", "computer science", "analytics"]
    },
    "marketing_manager": {
        "name": "Marketing Manager",
        "required_skills": ["digital marketing", "seo", "social media", "content marketing", "analytics", "campaign management"],
        "preferred_skills": ["google ads", "facebook ads", "email marketing", "crm", "marketing automation", "brand management"],
        "experience_keywords": ["managed", "launched", "increased", "improved", "coordinated", "strategized"],
        "education_keywords": ["marketing", "business administration", "communications", "advertising"]
    }
}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_pdf(file_path):
    text = ""
    try:
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text()
    except Exception as e:
        print(f"Error reading PDF: {e}")
    return text

def extract_text_from_docx(file_path):
    text = ""
    try:
        doc = docx.Document(file_path)
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
    except Exception as e:
        print(f"Error reading DOCX: {e}")
    return text

def extract_text_from_txt(file_path):
    text = ""
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            text = file.read()
    except Exception as e:
        print(f"Error reading TXT: {e}")
    return text

def extract_text_from_file(file_path, filename):
    extension = filename.rsplit('.', 1)[1].lower()
    
    if extension == 'pdf':
        return extract_text_from_pdf(file_path)
    elif extension == 'docx':
        return extract_text_from_docx(file_path)
    elif extension == 'txt':
        return extract_text_from_txt(file_path)
    else:
        return ""


def extract_contact_info_fallback(text):
    """Fallback contact extraction if Gemini fails"""
    contact_info = {}
    
    # Email extraction
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    emails = re.findall(email_pattern, text)
    contact_info['emails'] = emails
    
    # Phone number extraction
    phone_pattern = r'(\+\d{1,3}[-.\ s]?)?\(?\d{3}\)?[-.\ s]?\d{3}[-.\ s]?\d{4}'
    phones = re.findall(phone_pattern, text)
    contact_info['phones'] = [phone[0] + phone[1] if isinstance(phone, tuple) else phone for phone in phones]
    
    # LinkedIn profile extraction
    linkedin_pattern = r'linkedin\.com/in/[\w-]+'
    linkedin = re.findall(linkedin_pattern, text.lower())
    contact_info['linkedin'] = linkedin
    
    return contact_info


def analyze_resume_with_gemini(resume_text, job_profile_key=None):
    """Use Gemini API to analyze resume comprehensively"""
    
    job_profile_info = ""
    if job_profile_key and job_profile_key in JOB_PROFILES:
        profile = JOB_PROFILES[job_profile_key]
        job_profile_info = f"""
        
Job Profile: {profile['name']}
        Required Skills: {', '.join(profile['required_skills'])}
        Preferred Skills: {', '.join(profile['preferred_skills'])}
        Experience Keywords: {', '.join(profile['experience_keywords'])}
        Education Keywords: {', '.join(profile['education_keywords'])}
        """
    
    prompt = f"""
    Analyze the following resume text and provide a comprehensive analysis in JSON format.
    {job_profile_info}
    
    Resume Text:
    {resume_text}
    
    Please provide the analysis in the following JSON structure:
    {{
        "contact_info": {{
            "emails": ["list of email addresses found"],
            "phones": ["list of phone numbers found"],
            "linkedin": ["list of LinkedIn profile URLs found"]
        }},
        "skills": ["list of technical and professional skills identified"],
        "experience_years": "number of years of experience (as integer)",
        "education": ["list of educational qualifications found"],
        "match_score": "overall match score out of 100 (if job profile provided)",
        "match_details": {{
            "required_skills_match": "X/Y format showing matches",
            "preferred_skills_match": "X/Y format showing matches",
            "experience_keywords_match": "X/Y format showing matches",
            "education_keywords_match": "X/Y format showing matches",
            "required_score": "score for required skills (0-40)",
            "preferred_score": "score for preferred skills (0-25)",
            "experience_score": "score for experience keywords (0-20)",
            "education_score": "score for education keywords (0-15)"
        }},
        "recommendations": ["list of specific recommendations to improve the resume"],
        "summary": "brief summary of the candidate's profile",
        "resume_description": "detailed description of what the resume contains, including key highlights, career progression, and notable achievements",
        "general_thoughts": "overall evaluation and thoughts about the resume quality, presentation, strengths, and areas for improvement"
    }}
    
    Important guidelines:
    - Extract contact information accurately using pattern recognition
    - Identify all relevant technical and soft skills
    - Calculate experience years from text patterns like "X years of experience"
    - For match scoring (if job profile provided): use weighted scoring - Required skills: 40%, Preferred skills: 25%, Experience keywords: 20%, Education keywords: 15%
    - Provide actionable recommendations for resume improvement
    - For resume_description: Include career progression, key achievements, education background, and notable projects or experiences
    - For general_thoughts: Evaluate resume formatting, content quality, completeness, professional presentation, and overall impression
    - Return only valid JSON, no additional text
    """
    
    max_retries = 3
    retry_delay = 1
    
    for attempt in range(max_retries):
        try:
            response = model.generate_content(prompt)
            # Extract text from response candidates for Gemini 2.5 Pro
            response_text = ""
            if response.candidates:
                for candidate in response.candidates:
                    parts = candidate.content.parts
                    if parts:
                        for part in parts:
                            if part.text:
                                response_text += part.text
            else:
                # Fallback to original method
                response_text = response.text
            
            response_text = response_text.strip()
            
            # Remove markdown code blocks if present
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            
            response_text = response_text.strip()
            
            # Parse JSON response
            analysis_result = json.loads(response_text)
            
            # Validate and ensure all required fields exist
            required_fields = {
                "contact_info": {},
                "skills": [],
                "experience_years": 0,
                "education": [],
                "match_score": 0,
                "match_details": {},
                "recommendations": [],
                "summary": "",
                "resume_description": "",
                "general_thoughts": ""
            }
            
            for field, default_value in required_fields.items():
                if field not in analysis_result:
                    analysis_result[field] = default_value
            
            return analysis_result
            
        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {e}")
            print(f"Response text: {response_text}")
            return {
                "contact_info": extract_contact_info_fallback(resume_text),
                "skills": [],
                "experience_years": 0,
                "education": [],
                "match_score": 0,
                "match_details": {},
                "recommendations": ["JSON parsing error in AI response. Please try again."],
                "summary": "Analysis unavailable due to parsing error.",
                "resume_description": "Unable to generate description due to parsing error.",
                "general_thoughts": "Analysis unavailable due to technical error."
            }
        except Exception as e:
            error_str = str(e)
            print(f"Error with Gemini API (attempt {attempt + 1}): {e}")
            
            # Check if it's a rate limit error
            if "429" in error_str or "quota" in error_str.lower():
                if attempt < max_retries - 1:
                    # Extract retry delay from error message if available
                    if "retry_delay" in error_str:
                        try:
                            import re
                            delay_match = re.search(r'seconds: (\d+)', error_str)
                            if delay_match:
                                retry_delay = int(delay_match.group(1))
                        except:
                            pass
                    
                    print(f"Rate limit hit. Waiting {retry_delay} seconds before retry...")
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                    continue
                else:
                    return {
                        "contact_info": extract_contact_info_fallback(resume_text),
                        "skills": [],
                        "experience_years": 0,
                        "education": [],
                        "match_score": 0,
                        "match_details": {},
                        "recommendations": ["Rate limit exceeded. Please try again later or upgrade your Gemini API plan."],
                        "summary": "Analysis unavailable due to rate limiting.",
                        "resume_description": "Unable to generate description due to rate limiting.",
                        "general_thoughts": "Analysis unavailable due to API rate limits."
                    }
            else:
                # Non-rate-limit error, return immediately
                return {
                    "contact_info": extract_contact_info_fallback(resume_text),
                    "skills": [],
                    "experience_years": 0,
                    "education": [],
                    "match_score": 0,
                    "match_details": {},
                    "recommendations": [f"Error occurred during AI analysis: {error_str}"],
                    "summary": "Analysis unavailable due to technical error.",
                    "resume_description": "Unable to generate description due to technical error.",
                    "general_thoughts": "Analysis unavailable due to technical error."
                }

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "message": "Resume Analysis API is running"})

@app.route('/api/job-profiles', methods=['GET'])
def get_job_profiles():
    profiles = []
    for key, profile in JOB_PROFILES.items():
        profiles.append({
            "id": key,
            "name": profile["name"]
        })
    return jsonify(profiles)

def generate_job_profile_with_gemini(job_role):
    """Use Gemini to generate job profile skills and keywords based on job role"""
    prompt = f"""
    Based on the job role "{job_role}", generate a comprehensive job profile with relevant skills and keywords.
    
    Please provide the response in the following JSON structure:
    {{
        "required_skills": ["list of 8-12 essential technical and professional skills for this role"],
        "preferred_skills": ["list of 6-10 additional skills that would be beneficial"],
        "experience_keywords": ["list of 6-8 action words/verbs commonly found in resumes for this role"],
        "education_keywords": ["list of 4-6 educational backgrounds or fields relevant to this role"]
    }}
    
    Guidelines:
    - Focus on current industry standards and requirements
    - Include both technical and soft skills where appropriate
    - Make skills specific and relevant to the role
    - Use lowercase for consistency
    - Return only valid JSON, no additional text
    """
    
    try:
        response = model.generate_content(prompt)
        response_text = ""
        if response.candidates:
            for candidate in response.candidates:
                parts = candidate.content.parts
                if parts:
                    for part in parts:
                        if part.text:
                            response_text += part.text
        else:
            response_text = response.text
        
        response_text = response_text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.startswith('```'):
            response_text = response_text[3:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        
        response_text = response_text.strip()
        
        # Parse JSON response
        profile_data = json.loads(response_text)
        
        # Validate required fields
        required_fields = ["required_skills", "preferred_skills", "experience_keywords", "education_keywords"]
        for field in required_fields:
            if field not in profile_data:
                profile_data[field] = []
        
        return profile_data
        
    except Exception as e:
        print(f"Error generating profile with Gemini: {e}")
        # Return default structure if Gemini fails
        return {
            "required_skills": [],
            "preferred_skills": [],
            "experience_keywords": [],
            "education_keywords": []
        }

@app.route('/api/job-profiles', methods=['POST'])
def create_job_profile():
    try:
        data = request.get_json()
        
        if not data or 'name' not in data:
            return jsonify({"error": "Profile name is required"}), 400
        
        # Generate a unique ID for the new profile
        profile_id = data['name'].lower().replace(' ', '_').replace('-', '_')
        
        # Check if profile already exists
        if profile_id in JOB_PROFILES:
            return jsonify({"error": "Profile with this name already exists"}), 400
        
        # Generate profile data using Gemini
        gemini_profile = generate_job_profile_with_gemini(data['name'])
        
        # Create new profile with Gemini-generated data
        new_profile = {
            "name": data['name'],
            "required_skills": gemini_profile.get('required_skills', []),
            "preferred_skills": gemini_profile.get('preferred_skills', []),
            "experience_keywords": gemini_profile.get('experience_keywords', []),
            "education_keywords": gemini_profile.get('education_keywords', [])
        }
        
        # Add to JOB_PROFILES
        JOB_PROFILES[profile_id] = new_profile
        
        return jsonify({
            "id": profile_id,
            "name": new_profile["name"],
            "message": "Profile created successfully with AI-generated skills"
        }), 201
        
    except Exception as e:
        return jsonify({"error": f"Error creating profile: {str(e)}"}), 500

@app.route('/api/job-profiles/<profile_id>', methods=['DELETE'])
def delete_job_profile(profile_id):
    try:
        if profile_id not in JOB_PROFILES:
            return jsonify({"error": "Profile not found"}), 404
        
        # Don't allow deletion of default profiles
        default_profiles = ["software_engineer", "data_scientist", "marketing_manager"]
        if profile_id in default_profiles:
            return jsonify({"error": "Cannot delete default profiles"}), 400
        
        del JOB_PROFILES[profile_id]
        
        return jsonify({"message": "Profile deleted successfully"}), 200
        
    except Exception as e:
        return jsonify({"error": f"Error deleting profile: {str(e)}"}), 500

@app.route('/api/analyze-resume', methods=['POST'])
def analyze_resume():
    try:
        # Check if file is present
        if 'resume' not in request.files:
            return jsonify({"error": "No resume file provided"}), 400
        
        file = request.files['resume']
        job_profile = request.form.get('job_profile', '')
        
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({"error": "File type not supported. Please upload PDF, DOC, DOCX, or TXT files"}), 400
        
        # Save file
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        try:
            # Extract text from file
            resume_text = extract_text_from_file(file_path, filename)
            
            if not resume_text.strip():
                return jsonify({"error": "Could not extract text from the resume"}), 400
            
            # Perform AI analysis using Gemini
            gemini_analysis = analyze_resume_with_gemini(resume_text, job_profile)
            
            # Prepare response
            analysis_result = {
                "filename": filename,
                "contact_info": gemini_analysis.get("contact_info", {}),
                "skills": gemini_analysis.get("skills", []),
                "experience_years": gemini_analysis.get("experience_years", 0),
                "education": gemini_analysis.get("education", []),
                "match_score": gemini_analysis.get("match_score", 0),
                "match_details": gemini_analysis.get("match_details", {}),
                "recommendations": gemini_analysis.get("recommendations", []),
                "summary": gemini_analysis.get("summary", ""),
                "resume_description": gemini_analysis.get("resume_description", ""),
                "general_thoughts": gemini_analysis.get("general_thoughts", ""),
                "job_profile": JOB_PROFILES.get(job_profile, {}).get("name", "") if job_profile else "",
                "word_count": len(resume_text.split()),
                "character_count": len(resume_text)
            }
            
            return jsonify(analysis_result)
        
        finally:
            # Clean up uploaded file
            if os.path.exists(file_path):
                os.remove(file_path)
    
    except Exception as e:
        return jsonify({"error": f"An error occurred during analysis: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
