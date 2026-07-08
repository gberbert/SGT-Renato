import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { KanbanSquare, Loader2, CheckCircle2 } from 'lucide-react';

const Login = () => {
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    
    if (!import.meta.env.VITE_FIREBASE_API_KEY) {
      setError('ERRO DE CONFIGURAÇÃO: A Chave de API do Firebase (VITE_FIREBASE_API_KEY) não foi preenchida no arquivo .env.local.');
      setLoading(false);
      return;
    }

    try {
      if (!isResetPassword) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await sendPasswordResetEmail(auth, email);
        setSuccess('Um link de redefinição de senha foi enviado para seu email.');
        setIsResetPassword(false);
      }
    } catch (err) {
      console.error(err);
      switch(err.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          setError('Email ou senha incorretos.');
          break;
        case 'auth/invalid-email':
          setError('Formato de email inválido.');
          break;
        default:
          setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass-panel">
        <div className="login-header">
          <KanbanSquare className="logo-icon" size={40} color="var(--primary)" />
          <h2>SGT</h2>
          <p>{!isResetPassword ? 'Faça login para acessar o painel' : 'Redefina sua senha'}</p>
        </div>

        {error && <div className="login-error">{error}</div>}
        {success && <div className="login-success" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={18} /> {success}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>E-mail</label>
            <input 
              type="email" 
              required 
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          {!isResetPassword && (
            <div className="form-group">
              <label>Senha</label>
              <input 
                type="password" 
                required 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
              />
            </div>
          )}
          
          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? <Loader2 className="spinner-icon" size={18} /> : (!isResetPassword ? 'Entrar' : 'Enviar Link de Recuperação')}
          </button>
        </form>

        <div className="login-footer">
          <button type="button" className="btn-link" onClick={() => { setIsResetPassword(!isResetPassword); setError(''); setSuccess(''); }}>
            {!isResetPassword ? 'Esqueci minha senha' : 'Voltar para o Login'}
          </button>
        </div>
      </div>

      <style>{`
        .login-container {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-base);
          background-image: radial-gradient(circle at top right, rgba(99, 102, 241, 0.15), transparent 400px);
        }
        .login-card {
          width: 100%;
          max-width: 400px;
          padding: 40px;
          border-radius: 16px;
        }
        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .login-header h2 {
          font-size: 1.5rem;
          margin: 16px 0 8px;
        }
        .login-header p {
          color: var(--text-muted);
          font-size: 0.9rem;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text-muted);
        }
        .form-group input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid var(--glass-border);
          background: rgba(0,0,0,0.2);
          color: var(--text-main);
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s;
        }
        .form-group input:focus {
          border-color: var(--primary);
        }
        .login-btn {
          width: 100%;
          justify-content: center;
          margin-top: 24px;
          padding: 12px;
          font-size: 1rem;
        }
        .login-error {
          background: rgba(239, 68, 68, 0.1);
          color: var(--danger);
          padding: 12px;
          border-radius: 8px;
          font-size: 0.85rem;
          margin-bottom: 24px;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .login-footer {
          margin-top: 24px;
          text-align: center;
        }
        .btn-link {
          background: none;
          border: none;
          color: var(--primary);
          cursor: pointer;
          font-size: 0.9rem;
          font-family: inherit;
        }
        .btn-link:hover {
          text-decoration: underline;
        }
        .spinner-icon {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Login;
