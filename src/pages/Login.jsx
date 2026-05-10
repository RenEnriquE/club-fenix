import { useState } from 'react'
import { signIn } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError('Credenciales incorrectas. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div style={{width:56,height:56,borderRadius:'50%',background:'#e8f5ee',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto'}}>
            <i className="ti ti-shield-star" style={{fontSize:28,color:'#1a5e3a'}}></i>
          </div>
          <h1>Independencia Fénix</h1>
          <p>Sistema de gestión de cuotas</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{marginBottom:12}}>
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              required
              autoFocus
            />
          </div>
          <div className="form-group" style={{marginBottom:20}}>
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <div className="alert error"><i className="ti ti-alert-circle"></i>{error}</div>}
          <button className="btn primary" type="submit" disabled={loading} style={{width:'100%',justifyContent:'center',marginTop:8}}>
            {loading ? <><div className="spinner" style={{width:16,height:16,borderWidth:2}}></div>Ingresando...</> : <><i className="ti ti-login"></i>Ingresar</>}
          </button>
        </form>
      </div>
    </div>
  )
}
