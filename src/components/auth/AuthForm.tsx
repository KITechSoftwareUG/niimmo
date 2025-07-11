
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Lock, User } from 'lucide-react';

interface AuthFormProps {
  mode: 'login' | 'signup';
  onToggleMode: () => void;
}

export const AuthForm = ({ mode, onToggleMode }: AuthFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    console.log('Auth form submitted:', { mode, email });

    // Basic validation
    if (!email || !password) {
      setError('Bitte füllen Sie alle Felder aus');
      setLoading(false);
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'login') {
        console.log('Attempting login...');
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        console.log('Login response:', { data, error });

        if (error) {
          console.error('Login error:', error);
          
          // Handle different error cases
          if (error.message.includes('Invalid login credentials')) {
            setError('Ungültige Anmeldedaten. Bitte überprüfen Sie E-Mail und Passwort oder registrieren Sie sich zuerst.');
          } else if (error.message.includes('Email not confirmed')) {
            setError('Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.');
          } else if (error.message.includes('Too many requests')) {
            setError('Zu viele Anmeldeversuche. Bitte warten Sie einen Moment.');
          } else {
            setError(`Anmeldefehler: ${error.message}`);
          }
        } else if (data?.user) {
          console.log('Login successful:', data);
          setSuccess('Erfolgreich angemeldet!');
        }
      } else {
        console.log('Attempting signup...');
        const redirectUrl = `${window.location.origin}/`;
        
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectUrl
          }
        });

        console.log('Signup response:', { data, error });

        if (error) {
          console.error('Signup error:', error);
          
          // Handle different signup errors
          if (error.message.includes('User already registered')) {
            setError('Ein Benutzer mit dieser E-Mail-Adresse ist bereits registriert. Bitte melden Sie sich an.');
          } else if (error.message.includes('Password should be at least')) {
            setError('Das Passwort ist zu schwach. Bitte verwenden Sie ein stärkeres Passwort.');
          } else if (error.message.includes('Invalid email')) {
            setError('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
          } else {
            setError(`Registrierungsfehler: ${error.message}`);
          }
        } else if (data?.user) {
          console.log('Signup successful:', data);
          if (data.user.email_confirmed_at) {
            setSuccess('Registrierung erfolgreich! Sie werden automatisch angemeldet.');
          } else {
            setSuccess('Registrierung erfolgreich! Bitte überprüfen Sie Ihre E-Mail zur Bestätigung.');
          }
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <User className="h-12 w-12 text-red-500" />
        </div>
        <CardTitle className="text-2xl font-bold">
          {mode === 'login' ? 'Anmelden' : 'Registrieren'}
        </CardTitle>
        <CardDescription>
          {mode === 'login' 
            ? 'Melden Sie sich in Ihrem NiImmo Account an' 
            : 'Erstellen Sie einen neuen NiImmo Account'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="ihre@email.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="password"
                type="password"
                placeholder="Mindestens 6 Zeichen"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-10"
                disabled={loading}
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Passwort wiederholen"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-500 text-green-700">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'login' ? 'Anmelden...' : 'Registrieren...'}
              </>
            ) : (
              mode === 'login' ? 'Anmelden' : 'Registrieren'
            )}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={onToggleMode}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
              disabled={loading}
            >
              {mode === 'login' 
                ? 'Noch kein Account? Jetzt registrieren' 
                : 'Bereits ein Account? Jetzt anmelden'
              }
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
