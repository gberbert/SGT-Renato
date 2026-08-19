import React, { useState, useEffect } from 'react';

import '@radix-ui/themes/styles.css';

import { Theme } from '@radix-ui/themes';

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { onAuthStateChanged, signOut } from 'firebase/auth';

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

import { auth, db } from './firebase';



import Login from './components/Login';

import ResetPassword from './components/ResetPassword';

import DemandasLayout from './layouts/DemandasLayout';
import { OperacaoRadarProvider } from './contexts/OperacaoRadarContext';



function App() {

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [user, setUser] = useState(null);

  const [userRole, setUserRole] = useState('user');

  const [loading, setLoading] = useState(true);



  const [theme, setTheme] = useState(() => {

    return localStorage.getItem('sgt_theme') || 'dark';

  });



  useEffect(() => {

    localStorage.setItem('sgt_theme', theme);

    if (theme === 'light') {

      document.body.classList.add('light');

    } else {

      document.body.classList.remove('light');

    }

  }, [theme]);



  const toggleTheme = () => {

    setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  };



  useEffect(() => {

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {

      setUser(currentUser);

      if (currentUser) {

        try {

          const userRef = doc(db, 'users', currentUser.uid);

          const userSnap = await getDoc(userRef);



          if (!userSnap.exists()) {

            await setDoc(userRef, {

              email: currentUser.email,

              displayName: currentUser.email.split('@')[0],

              role: 'user',

              createdAt: serverTimestamp()

            });

            setUserRole('user');

          } else {

            setUserRole(userSnap.data().role || 'user');

          }

        } catch (error) {

          console.error("Erro ao sincronizar usuário no Firestore:", error);

          setUserRole('user');

        }

      }

      setLoading(false);

    });

    return () => unsubscribe();

  }, []);



  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);



  const handleLogout = () => {

    signOut(auth);

  };



  if (loading) {

    return (

      <div className="loader-container">

        <div className="spinner"></div>

      </div>

    );

  }



  if (!user) {

    return (

      <Theme appearance={theme} accentColor="iris" panelBackground="translucent">

        <Router>

          <Routes>

            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="*" element={<Login />} />

          </Routes>

        </Router>

      </Theme>

    );

  }



  return (

    <Theme appearance={theme} accentColor="iris" panelBackground="translucent">

      <Router>

        <OperacaoRadarProvider user={user}>

        <Routes>

          <Route path="/portal" element={<Navigate to="/" replace />} />

          <Route

            path="/operacao/config"

            element={<Navigate to="/configuracoes?tab=jiraOperacao&jira=config" replace />}

          />

          <Route

            path="/operacao/carga"

            element={<Navigate to="/configuracoes?tab=jiraOperacao&jira=carga" replace />}

          />

          <Route path="/operacao/*" element={<Navigate to="/" replace />} />

          <Route

            path="/*"

            element={

              <DemandasLayout

                userRole={userRole}

                user={user}

                theme={theme}

                toggleTheme={toggleTheme}

                handleLogout={handleLogout}

                isSidebarOpen={isSidebarOpen}

                toggleSidebar={toggleSidebar}

              />

            }

          />

        </Routes>

        </OperacaoRadarProvider>

      </Router>

    </Theme>

  );

}



export default App;


