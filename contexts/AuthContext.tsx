
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { dbService, UserProfile } from '../services/dbService';

interface AuthContextType {
  isAuthenticated: boolean;
  operatorId: string | null;
  login: (id: string, passkey: string, onStep?: (msg: string) => void) => Promise<void>;
  register: (id: string, passkey: string, onStep?: (msg: string) => void) => Promise<void>;
  logout: () => void;
  resetError: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SESSION_KEY = 'sentinel_active_session';
const PBKDF2_ITERATIONS = 100000;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      const { id, expiry } = JSON.parse(savedSession);
      if (Date.now() < expiry) {
        setIsAuthenticated(true);
        setOperatorId(id);
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  };

  const base64ToArrayBuffer = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  };

  const deriveHash = async (password: string, salt: ArrayBuffer, iterations: number): Promise<string> => {
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256",
      },
      baseKey,
      256
    );
    return arrayBufferToBase64(derivedBits);
  };

  const login = async (id: string, passkey: string, onStep?: (msg: string) => void) => {
    setError(null);
    const normalizedId = id.toUpperCase();
    
    try {
      onStep?.("Locating operator profile in registry...");
      const user = await dbService.getUser(normalizedId);
      
      if (!user) {
        await new Promise(r => setTimeout(r, 1000)); // Artificial latency for security
        throw new Error("ACCESS_DENIED: Identity not found in secure registry.");
      }

      onStep?.("Found profile. Initiating PBKDF2-SHA256 derivation...");
      const saltBuffer = base64ToArrayBuffer(user.salt);
      const hashedInput = await deriveHash(passkey, saltBuffer, user.iterations);

      onStep?.(`Validating hash against stored entropy (${user.iterations} iterations)...`);
      await new Promise(r => setTimeout(r, 800));

      if (user.passwordHash === hashedInput) {
        onStep?.("Handshake successful. Establishing secure session...");
        setIsAuthenticated(true);
        setOperatorId(normalizedId);
        localStorage.setItem(SESSION_KEY, JSON.stringify({
          id: normalizedId,
          expiry: Date.now() + 1000 * 60 * 60 * 24
        }));
        await dbService.logAction(normalizedId, 'LOGIN', 'Standard biometric handshake complete.');
      } else {
        await dbService.logAction(normalizedId, 'LOGIN_FAIL', 'Invalid passkey provided.');
        throw new Error("IDENTITY_VERIFICATION_FAILED: Invalid credentials.");
      }
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  };

  const register = async (id: string, passkey: string, onStep?: (msg: string) => void) => {
    setError(null);
    const normalizedId = id.toUpperCase();

    try {
      onStep?.("Checking registry for collision...");
      const existing = await dbService.getUser(normalizedId);
      if (existing) throw new Error("PROVISIONING_ERROR: ID already registered.");

      onStep?.("Generating cryptographically secure 16-byte salt...");
      const salt = crypto.getRandomValues(new Uint8Array(16));
      
      onStep?.(`Executing PBKDF2 hash (${PBKDF2_ITERATIONS} rounds)...`);
      const hash = await deriveHash(passkey, salt.buffer, PBKDF2_ITERATIONS);
      
      onStep?.("Committing operator profile to IndexedDB...");
      const profile: UserProfile = {
        id: normalizedId,
        passwordHash: hash,
        salt: arrayBufferToBase64(salt.buffer),
        iterations: PBKDF2_ITERATIONS
      };

      await dbService.saveUser(profile);
      await dbService.logAction(normalizedId, 'REGISTRATION', 'New operator profile provisioned.');
      
      onStep?.("Registration complete. Logging in...");
      setIsAuthenticated(true);
      setOperatorId(normalizedId);
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        id: normalizedId,
        expiry: Date.now() + 1000 * 60 * 60 * 24
      }));
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  };

  const logout = () => {
    if (operatorId) dbService.logAction(operatorId, 'LOGOUT', 'Operator terminated session.');
    setIsAuthenticated(false);
    setOperatorId(null);
    localStorage.removeItem(SESSION_KEY);
  };

  // Fix: Implement resetError function to clear authentication error messages
  const resetError = () => setError(null);

  return (
    <AuthContext.Provider value={{ isAuthenticated, operatorId, login, register, logout, resetError, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
