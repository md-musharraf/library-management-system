async function run() {
  console.log("🚀 Starting Rate Limiter Test on Login API...")
  
  for (let i = 1; i <= 12; i++) {
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'wrong_password' })
      })
      
      console.log(`Request #${i}: Status = ${res.status} (${res.statusText})`)
      
      if (res.status === 429) {
        const data: any = await res.json()
        console.log("🛑 Blocked by Rate Limiter!", data)
      }
    } catch (err) {
      console.error(`Request #${i} Failed:`, err)
    }
  }
}

run()
