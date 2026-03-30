async function test() {
  const token = 'fake'; // actually, I need a real token or bypass auth?
  // Let's just send the request
  const res = await fetch('http://localhost:3000/api/hotspot-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      routerId: 'clufgabcdefg123456',
      primaryColor: '#1a1a2e',
      accentColor: '#6366f1',
      selectedFont: 'Inter',
      layout: 'grid',
      enableAds: false,
      adMessage: 'msg',
      enableRememberMe: true,
      companyName: 'com',
      customerCareNumber: '123'
    })
  });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', data);
}
test();
