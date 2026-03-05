import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { mockTutorialVideos } from '../data/mockData';

const categories = ['All', ...Array.from(new Set(mockTutorialVideos.map(v => v.category)))];

import { useState } from 'react';

export default function TutorialVideos() {
    const [activeCategory, setActiveCategory] = useState('All');
    const [selectedVideo, setSelectedVideo] = useState<typeof mockTutorialVideos[0] | null>(null);

    const filtered = activeCategory === 'All' ? mockTutorialVideos : mockTutorialVideos.filter(v => v.category === activeCategory);

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: 'var(--danger-light)', color: 'var(--primary)' }}>
                        <PlayCircleIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Tutorial Videos</h1>
                        <p className="page-subtitle">Learn how to use all features of the billing system</p>
                    </div>
                </div>
            </div>

            {/* Category filters */}
            <div className="filter-chips" style={{ marginBottom: 20 }}>
                {categories.map(cat => (
                    <button
                        key={cat}
                        className={`filter-chip ${activeCategory === cat ? 'active' : ''}`}
                        onClick={() => setActiveCategory(cat)}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Video modal */}
            {selectedVideo && (
                <div className="modal-overlay" onClick={() => setSelectedVideo(null)}>
                    <div className="modal" style={{ maxWidth: 760 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-header-left">
                                <div className="modal-header-icon" style={{ background: 'var(--danger-light)', color: 'var(--primary)' }}>
                                    <PlayCircleIcon fontSize="small" />
                                </div>
                                <div>
                                    <div className="modal-title">{selectedVideo.title}</div>
                                    <div className="modal-subtitle">{selectedVideo.category}</div>
                                </div>
                            </div>
                            <button className="modal-close" onClick={() => setSelectedVideo(null)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ padding: 0 }}>
                            <iframe
                                width="100%"
                                height="400"
                                src={selectedVideo.videoUrl}
                                title={selectedVideo.title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                style={{ display: 'block', border: 'none' }}
                            />
                            <div style={{ padding: 20 }}>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{selectedVideo.description}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Video grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                {filtered.map(video => (
                    <div key={video.id} className="card" style={{ overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                        onClick={() => setSelectedVideo(video)}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
                    >
                        {/* Thumbnail */}
                        <div style={{ height: 160, background: 'linear-gradient(135deg, #1a1a2e, #2d3039)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            <PlayCircleIcon style={{ fontSize: 56, color: 'var(--primary)', opacity: 0.9 }} />
                            <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <AccessTimeIcon style={{ fontSize: 12 }} /> {video.duration}
                            </div>
                            <div style={{ position: 'absolute', top: 10, left: 10, background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem' }}>
                                {video.category}
                            </div>
                        </div>
                        <div style={{ padding: '16px' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 6 }}>{video.title}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{video.description}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
