'use strict';


const S = {
  user:             null,
  history:          [],
  file:             null,
  audio64:          null,
  script:           null,
  shareId:          null,
  currentPodcastId: null,
  generating:       false,
  connected:        false,
  stepTimer:        null,
  search:           '',
  renamingId:       null,
};


try {
  const u = localStorage.getItem('pai_user');
  if (u) S.user = JSON.parse(u);
} catch (_) {}


const API   = () => (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000'
  : window.location.origin;

const TOKEN = () => S.user?.token || '';