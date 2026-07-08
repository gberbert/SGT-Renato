import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../firebase';
import { Button, Card, Flex, Text, TextField, Box } from '@radix-ui/themes';
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = searchParams.get('oobCode');
  
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (oobCode) {
      verifyPasswordResetCode(auth, oobCode)
        .then(emailStr => setEmail(emailStr))
        .catch(() => setError("O link de redefinição de senha é inválido ou já expirou."));
    } else {
      setError("O link acessado não contém o código necessário.");
    }
  }, [oobCode]);

  const handleReset = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess(true);
    } catch (err) {
      setError("Ocorreu um erro ao redefinir sua senha. Tente solicitar um novo link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--gray-2)' }}>
      <Card size="4" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
        <Flex direction="column" align="center" gap="4">
          
          <div style={{ background: 'var(--primary)', color: 'white', padding: '16px', borderRadius: '50%', marginBottom: '8px' }}>
            {success ? <ShieldCheck size={32} /> : <AlertCircle size={32} />}
          </div>

          <Text as="h1" size="6" weight="bold" align="center">
            {success ? 'Senha Redefinida!' : 'Criar Nova Senha'}
          </Text>

          {error && (
            <div style={{ background: 'var(--danger)', color: 'white', padding: '12px', borderRadius: '8px', width: '100%', fontSize: '14px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {!success ? (
            <form onSubmit={handleReset} style={{ width: '100%' }}>
              <Flex direction="column" gap="4">
                {email && (
                  <Box>
                    <Text as="div" size="2" color="gray" mb="1" align="center">
                      Redefinindo senha para:
                    </Text>
                    <Text as="div" size="2" weight="bold" align="center" mb="3">
                      {email}
                    </Text>
                  </Box>
                )}

                <Box>
                  <Text as="div" size="2" weight="bold" mb="1">Nova Senha</Text>
                  <TextField.Root 
                    type="password"
                    placeholder="No mínimo 6 caracteres..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </Box>
                
                <Button size="3" mt="2" type="submit" disabled={loading || !oobCode || error}>
                  {loading ? <Loader2 className="spinner-icon" size={18} /> : 'Salvar Nova Senha'}
                </Button>
                
                <Flex justify="center" mt="3">
                  <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '14px' }}>
                    Voltar para o Login
                  </Link>
                </Flex>
              </Flex>
            </form>
          ) : (
            <Flex direction="column" gap="4" align="center" style={{ width: '100%' }}>
              <Text as="p" size="3" color="gray" align="center">
                Sua senha foi redefinida com sucesso. Você já pode acessar a plataforma utilizando a nova senha.
              </Text>
              <Button size="3" style={{ width: '100%' }} onClick={() => navigate('/')}>
                Acessar Plataforma
              </Button>
            </Flex>
          )}

        </Flex>
      </Card>
    </div>
  );
};

export default ResetPassword;
