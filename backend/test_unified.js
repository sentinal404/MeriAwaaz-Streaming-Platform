
async function run() {
  try {
    const res = await fetch('http://localhost:3004/api/auth/unified', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'devil01hzb@gmail.com', password: 'wrongpassword' })
    });
    const text = await res.text();
    console.log(res.status, text);
  } catch(e) {
    console.error(e);
  }
}
run();
