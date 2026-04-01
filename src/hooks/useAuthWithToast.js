import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const useAuthWithToast = () => {
  const { signup, login, logout, resetPassword, currentUser, updateUserMeta } = useAuth();
  const { addToast } = useToast();

  const signupWithToast = async (email, password, name) => {
    try {
      const result = await signup(email, password, name);
      addToast('Account created successfully!', 'success');
      return result;
    } catch (error) {
      let errorMessage = 'Failed to create account';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email is already in use. Please use a different email.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address. Please enter a valid email.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      addToast(errorMessage, 'error');
      throw error;
    }
  };

  const loginWithToast = async (email, password) => {
    try {
      const result = await login(email, password);
      addToast('Logged in successfully!', 'success');
      return result;
    } catch (error) {
      let errorMessage = 'Failed to log in';

      if (
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-login-credentials' ||
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/invalid-email'
      ) {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/Password authentication is not enabled.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      addToast(errorMessage, 'error');
      throw error;
    }
  };

  const logoutWithToast = async () => {
    try {
      await logout();
      addToast('Logged out successfully!', 'info');
      return Promise.resolve();
    } catch (error) {
      addToast('Failed to log out', 'error');
      throw error;
    }
  };

  const resetPasswordWithToast = async (email) => {
    try {
      await resetPassword(email);
      addToast('Password reset email sent successfully! Please check your inbox.', 'success');
      return Promise.resolve();
    } catch (error) {
      let errorMessage = 'Failed to send password reset email';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      addToast(errorMessage, 'error');
      throw error;
    }
  };

  const updateUserMetaWithToast = async (data) => {
    try {
      await updateUserMeta(data);
      addToast('Profile updated successfully!', 'success');
    } catch (error) {
      addToast('Failed to update profile', 'error');
      throw error;
    }
  };

  return {
    signup: signupWithToast,
    login: loginWithToast,
    logout: logoutWithToast,
    resetPassword: resetPasswordWithToast,
    updateUserMeta: updateUserMetaWithToast,
    currentUser
  };
};