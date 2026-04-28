try {
  const r = await fetch('http://localhost:5000/api/account/referrals');
  console.log('status=' + r.status);
} catch (e) {
  console.log('error');
}
