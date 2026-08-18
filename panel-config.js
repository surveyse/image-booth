/**
 * Panel auth + Cloudinary list source
 */
window.IMAGE_PANEL_AUTH = {
  mode: 'local',
  users: [
    { email: 'tahmanage@gmail.com', password: '112233' },
    { email: 'kingyon@gmail.com', password: '11223344y' }
  ],

  // Used by panel to load photos from Cloudinary (tag: web-capture)
  cloudName: 'szh7c4xk',
  listTag: 'web-capture',

  supabaseUrl: 'https://YOUR_PROJECT_ID.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY'
};
