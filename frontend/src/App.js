import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { Upload, FileText, Mail, Phone, Linkedin, Award, BookOpen, TrendingUp, AlertCircle, Settings, Plus, Trash2, X } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  const [file, setFile] = useState(null);
  const [jobProfile, setJobProfile] = useState('');
  const [jobProfiles, setJobProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [showManageModal, setShowManageModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileSkills, setNewProfileSkills] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // Fetch job profiles on component mount
  React.useEffect(() => {
    fetchJobProfiles();
  }, []);

  const fetchJobProfiles = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/job-profiles');
      setJobProfiles(response.data);
    } catch (err) {
      console.error('Error fetching job profiles:', err);
      setError('Failed to connect to backend server. Please ensure the backend is running on port 5000.');
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    multiple: false,
    maxSize: 16 * 1024 * 1024 // 16MB
  });

  const handleAnalyze = async () => {
    if (!file) {
      setError('Please upload a resume file');
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);

    const formData = new FormData();
    formData.append('resume', file);
    if (jobProfile) {
      formData.append('job_profile', jobProfile);
    }

    try {
      const response = await axios.post('http://localhost:5000/api/analyze-resume', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setResults(response.data);
    } catch (err) {
      console.error('Analysis error:', err);
      if (err.code === 'ERR_NETWORK') {
        setError('Cannot connect to backend server. Please ensure the backend is running on port 5000.');
      } else {
        setError(err.response?.data?.error || 'An error occurred during analysis');
      }
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 70) return 'score-excellent';
    if (score >= 50) return 'score-good';
    return 'score-poor';
  };

  const getScoreLabel = (score) => {
    if (score >= 70) return 'Excellent Match';
    if (score >= 50) return 'Good Match';
    return 'Needs Improvement';
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      setModalError('Profile name is required');
      return;
    }

    setModalLoading(true);
    setModalError('');

    try {
      const skillsArray = newProfileSkills.split(',').map(skill => skill.trim()).filter(skill => skill);
      
      const response = await axios.post('http://localhost:5000/api/job-profiles', {
        name: newProfileName.trim(),
        required_skills: skillsArray,
        preferred_skills: [],
        experience_keywords: [],
        education_keywords: []
      });

      // Refresh job profiles list
      await fetchJobProfiles();
      
      // Reset form
      setNewProfileName('');
      setNewProfileSkills('');
      setModalError('');
      
      toast.success('Profile created successfully!');
    } catch (err) {
      setModalError(err.response?.data?.error || 'Failed to create profile');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteProfile = async (profileId, profileName) => {
    if (!window.confirm(`Are you sure you want to delete the profile "${profileName}"?`)) {
      return;
    }

    try {
      await axios.delete(`http://localhost:5000/api/job-profiles/${profileId}`);
      
      // Refresh job profiles list
      await fetchJobProfiles();
      
      // Reset selected job profile if it was deleted
      if (jobProfile === profileId) {
        setJobProfile('');
      }
      
      toast.success('Profile deleted successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete profile');
    }
  };

  const closeModal = () => {
    setShowManageModal(false);
    setNewProfileName('');
    setNewProfileSkills('');
    setModalError('');
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Resume Analysis</h1>
        <p>Upload a resume and provide a job description to analyze the candidate's fit.</p>
      </div>

      <div className="main-content">
        <div className="card">
          <h2>Upload Resume</h2>
          <div
            {...getRootProps()}
            className={`upload-area ${isDragActive ? 'dragover' : ''}`}
          >
            <input {...getInputProps()} />
            <Upload className="upload-icon" size={48} />
            <div className="upload-text">
              {file ? file.name : 'Drag & drop a resume file here, or click to select'}
            </div>
            <div className="upload-subtext">
              Supported formats: PDF, DOC, DOCX, TXT
            </div>
          </div>
        </div>

        <div className="card">
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label className="form-label">Job Profile</label>
              <button
                type="button"
                onClick={() => setShowManageModal(true)}
                style={{
                  background: 'none',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.75rem',
                  color: '#6b7280'
                }}
              >
                <Settings size={14} />
                Manage
              </button>
            </div>
            <select
              className="form-select"
              value={jobProfile}
              onChange={(e) => setJobProfile(e.target.value)}
            >
              <option value="">Select a Job Profile</option>
              {jobProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div className="form-label">AI Model</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>gemini 1.5 flash</span>
              <span style={{ 
                background: '#e0f2fe', 
                color: '#0277bd', 
                padding: '2px 8px', 
                borderRadius: '12px', 
                fontSize: '0.75rem' 
              }}>
                Gemini
              </span>
            </div>
          </div>


          {error && <div className="error">{error}</div>}

          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={loading || !file}
            style={{ width: '100%' }}
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Analyzing Resume...
              </>
            ) : (
              'Analyze Resume'
            )}
          </button>
        </div>
      </div>

      {results && (
        <div className="results-section">
          <div className="results-grid">
            {jobProfile && (
              <div className="metric-card">
                <div className="metric-title">Match Score</div>
                <div className={`score-circle ${getScoreColor(results.match_score)}`}>
                  {results.match_score}%
                </div>
                <div style={{ textAlign: 'center', fontWeight: '500' }}>
                  {getScoreLabel(results.match_score)}
                </div>
              </div>
            )}

            <div className="metric-card">
              <div className="metric-title">Skills Found</div>
              <div className="metric-value">{results.skills.length}</div>
              <div className="skills-list">
                {results.skills.slice(0, 6).map((skill, index) => (
                  <span key={index} className="skill-tag">{skill}</span>
                ))}
                {results.skills.length > 6 && (
                  <span className="skill-tag">+{results.skills.length - 6} more</span>
                )}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-title">Experience</div>
              <div className="metric-value">
                {results.experience_years > 0 ? `${results.experience_years} years` : 'Not specified'}
              </div>
            </div>

            {/* <div className="metric-card">
              <div className="metric-title">Resume Stats</div>
              <div style={{ fontSize: '1rem', color: '#6b7280' }}>
                <div>Words: {results.word_count}</div>
                <div>Characters: {results.character_count}</div>
              </div>
            </div> */}
          </div>

          <div className="results-grid">
            <div className="card">
              <h2><Mail size={20} style={{ display: 'inline', marginRight: '8px' }} />Contact Information</h2>
              <div className="contact-info">
                {results.contact_info.emails.length > 0 && (
                  <div className="contact-item">
                    <Mail size={16} />
                    <span>{results.contact_info.emails[0]}</span>
                  </div>
                )}
                {results.contact_info.phones.length > 0 && (
                  <div className="contact-item">
                    <Phone size={16} />
                    <span>{results.contact_info.phones[0]}</span>
                  </div>
                )}
                {results.contact_info.linkedin.length > 0 && (
                  <div className="contact-item">
                    <Linkedin size={16} />
                    <span>{results.contact_info.linkedin[0]}</span>
                  </div>
                )}
                {results.contact_info.emails.length === 0 && 
                 results.contact_info.phones.length === 0 && 
                 results.contact_info.linkedin.length === 0 && (
                  <div style={{ color: '#9ca3af' }}>No contact information found</div>
                )}
              </div>
            </div>

            <div className="card">
              <h2><Award size={20} style={{ display: 'inline', marginRight: '8px' }} />All Skills</h2>
              <div className="skills-list">
                {results.skills.map((skill, index) => (
                  <span key={index} className="skill-tag">{skill}</span>
                ))}
              </div>
              {results.skills.length === 0 && (
                <div style={{ color: '#9ca3af' }}>No skills identified</div>
              )}
            </div>
          </div>

          {results.resume_description && (
            <div className="card" style={{ marginBottom: '10px'}}>
              <h2><FileText size={20} style={{ display: 'inline', marginRight: '8px' }} />Resume Description</h2>
              <p style={{ lineHeight: '1.6', color: '#4b5563', marginBottom: '0' }}>
                {results.resume_description}
              </p>
            </div>
          )}

          {results.general_thoughts && (
            <div className="card" style={{ marginBottom: '10px'}}>
              <h2><TrendingUp size={20} style={{ display: 'inline', marginRight: '8px'}} />General Thoughts</h2>
              <p style={{ lineHeight: '1.6', color: '#4b5563', marginBottom: '0' }}>
                {results.general_thoughts}
              </p>
            </div>
          )}

          {results.recommendations.length > 0 && (
            <div className="card" style={{ marginBottom: '10px'}}>
              <h2><AlertCircle size={20} style={{ display: 'inline', marginRight: '8px' }} />Recommendations</h2>
              <ul className="recommendations-list">
                {results.recommendations.map((recommendation, index) => (
                  <li key={index}>
                    <AlertCircle size={16} style={{ display: 'inline', marginRight: '8px', color: '#f59e0b' }} />
                    {recommendation}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {jobProfile && results.match_details && (
            <div className="card">
              <h2>Detailed Match Analysis</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <div className="metric-title">Required Skills</div>
                  <div className="metric-value">{results.match_details.required_skills_match}</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Score: {results.match_details.required_score}%
                  </div>
                </div>
                <div>
                  <div className="metric-title">Preferred Skills</div>
                  <div className="metric-value">{results.match_details.preferred_skills_match}</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Score: {results.match_details.preferred_score}%
                  </div>
                </div>
                <div>
                  <div className="metric-title">Experience Keywords</div>
                  <div className="metric-value">{results.match_details.experience_keywords_match}</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Score: {results.match_details.experience_score}%
                  </div>
                </div>
                <div>
                  <div className="metric-title">Education Keywords</div>
                  <div className="metric-value">{results.match_details.education_keywords_match}</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Score: {results.match_details.education_score}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="about-section">
        <h2><BookOpen size={20} style={{ display: 'inline', marginRight: '8px' }} />About Resume Analysis</h2>
        <p>
          Our Resume Analysis tool uses AI to compare a candidate's resume against a selected job profile to determine their fit for the role.
        </p>
        <p>
          The analysis includes skill extraction, experience evaluation, contact information parsing, and personalized recommendations for improvement.
        </p>
        <p>
          Upload a resume in PDF, DOC, DOCX, or TXT format and select a job profile to get started.
        </p>
      </div>

      {/* Manage Profiles Modal */}
      {showManageModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>Manage Job Profiles</h2>
              <button
                onClick={closeModal}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Add New Profile Section */}
            <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '500' }}>Add New Profile</h3>
              
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>Profile Name</label>
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder="e.g., Frontend Developer"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>Required Skills (comma-separated)</label>
                <textarea
                  value={newProfileSkills}
                  onChange={(e) => setNewProfileSkills(e.target.value)}
                  placeholder="e.g., React, JavaScript, CSS, HTML, Node.js"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              {modalError && (
                <div style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '12px' }}>
                  {modalError}
                </div>
              )}

              <button
                onClick={handleCreateProfile}
                disabled={modalLoading}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: modalLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.875rem',
                  opacity: modalLoading ? 0.6 : 1
                }}
              >
                <Plus size={16} />
                {modalLoading ? 'Creating...' : 'Add Profile'}
              </button>
            </div>

            {/* Existing Profiles Section */}
            <div>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '500' }}>Existing Profiles</h3>
              <div style={{ display: 'grid', gap: '8px' }}>
                {jobProfiles.map((profile) => {
                  const isDefault = ['software_engineer', 'data_scientist', 'marketing_manager'].includes(profile.id);
                  return (
                    <div
                      key={profile.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px'
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: '500' }}>{profile.name}</span>
                        {isDefault && (
                          <span style={{
                            marginLeft: '8px',
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            backgroundColor: '#f3f4f6',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            Default
                          </span>
                        )}
                      </div>
                      {!isDefault && (
                        <button
                          onClick={() => handleDeleteProfile(profile.id, profile.name)}
                          style={{
                            background: 'none',
                            border: '1px solid #fca5a5',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            color: '#dc2626'
                          }}
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Container */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />

    </div>
  );
}

export default App;
