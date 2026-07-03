import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { KanbanSquare, Loader2 } from 'lucide-react';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Check if API key is missing
    if (!import.meta.env.VITE_FIREBASE_API_KEY) {
      setError('ERRO DE CONFIGURAÇÃO: A Chave de API do Firebase (VITE_FIREBASE_API_KEY) não foi preenchida no arquivo .env.local.');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: userCredential.user.email,
          displayName: userCredential.user.email.split('@')[0],
          role: 'user',
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error(err);
      switch(err.code) {
        case 'auth/invalid-credential':
          setError('Email ou senha incorretos.');
          break;
        case 'auth/email-already-in-use':
          setError('Este email já está cadastrado.');
          break;
        case 'auth/weak-password':
          setError('A senha deve ter pelo menos 6 caracteres.');
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
          <p>{isLogin ? 'Faça login para acessar o painel' : 'Crie sua conta para acessar'}</p>
        </div>

        {error && <div className="login-error">{error}</div>}

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
          
          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? <Loader2 className="spinner-icon" size={18} /> : (isLogin ? 'Entrar' : 'Cadastrar')}
          </button>
        </form>

        <div className="login-footer">
          <button className="btn-link" onClick={() => { setIsLogin(!isLogin); setError(''); }}>
            {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Faça login'}
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
