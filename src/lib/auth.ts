export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: 'admin' | 'infection_preventionist' | 'nurse' | 'readonly';
  permissions: Permission[];
  createdAt: string;
  lastLogin?: string;
}

export type Permission =
  | 'view_ip_cases' | 'create_ip_cases' | 'edit_ip_cases' | 'delete_ip_cases'
  | 'view_abt' | 'create_abt' | 'edit_abt'
  | 'view_vax' | 'create_vax' | 'edit_vax'
  | 'view_census' | 'edit_census'
  | 'view_reports'
  | 'manage_users' | 'manage_settings';

const ROLE_PERMISSIONS: Record<User['role'], Permission[]> = {
  admin: [
    'view_ip_cases', 'create_ip_cases', 'edit_ip_cases', 'delete_ip_cases',
    'view_abt', 'create_abt', 'edit_abt',
    'view_vax', 'create_vax', 'edit_vax',
    'view_census', 'edit_census',
    'view_reports', 'manage_users', 'manage_settings'
  ],
  infection_preventionist: [
    'view_ip_cases', 'create_ip_cases', 'edit_ip_cases',
    'view_abt', 'create_abt', 'edit_abt',
    'view_vax', 'create_vax', 'edit_vax',
    'view_census', 'edit_census', 'view_reports'
  ],
  nurse: ['view_ip_cases', 'view_abt', 'view_vax', 'create_vax', 'edit_vax', 'view_census'],
  readonly: ['view_ip_cases', 'view_abt', 'view_vax', 'view_census', 'view_reports']
};

const PASSWORD_SALT = import.meta.env.VITE_PASSWORD_SALT || 'sparkle-salt-change-this';
const SESSION_TIMEOUT = Number(import.meta.env.VITE_SESSION_TIMEOUT || 30 * 60 * 1000);

const simpleHash = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
};

export const hashPassword = (password: string): string => simpleHash(password + PASSWORD_SALT);
export const verifyPassword = (password: string, hash: string): boolean => hashPassword(password) === hash;

const getUsers = (): User[] => {
  const usersJson = localStorage.getItem('icn_users');
  if (!usersJson) {
    const admin: User = {
      id: 'user_admin',
      username: 'admin',
      displayName: 'Administrator',
      email: 'admin@facility.com',
      role: 'admin',
      permissions: ROLE_PERMISSIONS.admin,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem('icn_users', JSON.stringify([admin]));
    localStorage.setItem('icn_passwords', JSON.stringify({ admin: hashPassword('admin123') }));
    return [admin];
  }

  return JSON.parse(usersJson);
};

const getPasswords = (): Record<string, string> => JSON.parse(localStorage.getItem('icn_passwords') || '{}');
const saveUsers = (users: User[]) => localStorage.setItem('icn_users', JSON.stringify(users));
const savePasswords = (passwords: Record<string, string>) => localStorage.setItem('icn_passwords', JSON.stringify(passwords));

export const login = (username: string, password: string): User | null => {
  const users = getUsers();
  const passwords = getPasswords();
  const user = users.find((u) => u.username === username);
  if (!user) return null;

  if (!passwords[username] || !verifyPassword(password, passwords[username])) return null;

  user.lastLogin = new Date().toISOString();
  saveUsers(users);
  sessionStorage.setItem('icn_current_user', JSON.stringify(user));
  sessionStorage.setItem('icn_session_start', new Date().toISOString());
  return user;
};

export const logout = (): void => {
  sessionStorage.removeItem('icn_current_user');
  sessionStorage.removeItem('icn_session_start');
};

export const getCurrentUser = (): User | null => {
  const raw = sessionStorage.getItem('icn_current_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

export const isAuthenticated = (): boolean => !!getCurrentUser();
export const hasPermission = (permission: Permission): boolean => !!getCurrentUser()?.permissions.includes(permission);

export const requireAuth = (): User => {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = '/login';
    throw new Error('Authentication required');
  }
  return user;
};

export const requirePermission = (permission: Permission): void => {
  const user = requireAuth();
  if (!user.permissions.includes(permission)) throw new Error(`Permission denied: ${permission}`);
};

let sessionTimeoutId: ReturnType<typeof setTimeout> | null = null;
const sessionActivities = ['mousedown', 'keydown', 'scroll', 'touchstart'];

export const resetSessionTimeout = (): void => {
  if (!isAuthenticated()) return;
  sessionStorage.setItem('icn_session_start', new Date().toISOString());
  if (sessionTimeoutId) clearTimeout(sessionTimeoutId);
  sessionTimeoutId = setTimeout(() => {
    logout();
    window.location.href = '/login?reason=timeout';
  }, SESSION_TIMEOUT);
};

export const initSessionMonitoring = (): void => {
  if (!isAuthenticated()) return;
  resetSessionTimeout();
  sessionActivities.forEach((event) => document.addEventListener(event, resetSessionTimeout));
};

export const cleanupSessionMonitoring = (): void => {
  if (sessionTimeoutId) clearTimeout(sessionTimeoutId);
  sessionActivities.forEach((event) => document.removeEventListener(event, resetSessionTimeout));
};

export const changePassword = (username: string, currentPassword: string, newPassword: string): void => {
  const passwords = getPasswords();
  if (!passwords[username] || !verifyPassword(currentPassword, passwords[username])) {
    throw new Error('Current password is incorrect');
  }
  if (newPassword.length < 8) throw new Error('New password must be at least 8 characters');
  passwords[username] = hashPassword(newPassword);
  savePasswords(passwords);
};
