import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  UserPlus, Edit, Trash2, Key, Shield,
} from 'lucide-react';
import {
  Permission,
  User,
  requirePermission,
  changePassword,
  getCurrentUser,
  hashPassword,
} from '@/lib/auth';
import { toast as sonnerToast } from 'sonner';

const UserManagementView = () => {
  requirePermission('manage_users');

  const [users, setUsers] = useState<User[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    email: '',
    role: 'readonly' as User['role'],
    password: '',
    confirmPassword: ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    const usersJson = localStorage.getItem('icn_users');
    if (usersJson) {
      setUsers(JSON.parse(usersJson));
    }
  };

  const handleCreateUser = () => {
    try {
      if (!formData.username || !formData.displayName || !formData.email || !formData.password) {
        sonnerToast.error('Validation Error', {
          description: 'All fields are required'
        });
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        sonnerToast.error('Validation Error', {
          description: 'Passwords do not match'
        });
        return;
      }

      if (formData.password.length < 8) {
        sonnerToast.error('Validation Error', {
          description: 'Password must be at least 8 characters'
        });
        return;
      }

      const existingUser = users.find(u => u.username === formData.username);
      if (existingUser) {
        sonnerToast.error('Username Taken', {
          description: 'This username already exists'
        });
        return;
      }

      const newUser: User = {
        id: `user_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        username: formData.username,
        displayName: formData.displayName,
        email: formData.email,
        role: formData.role,
        permissions: getRolePermissions(formData.role),
        createdAt: new Date().toISOString()
      };

      const updatedUsers = [...users, newUser];
      localStorage.setItem('icn_users', JSON.stringify(updatedUsers));

      const passwords = JSON.parse(localStorage.getItem('icn_passwords') || '{}');
      passwords[formData.username] = hashPassword(formData.password);
      localStorage.setItem('icn_passwords', JSON.stringify(passwords));

      loadUsers();
      setIsCreateModalOpen(false);
      resetFormData();

      sonnerToast.success('User Created', {
        description: `${formData.displayName} has been added`
      });
    } catch (error: any) {
      sonnerToast.error('Creation Failed', {
        description: error.message
      });
    }
  };

  const handleUpdateUser = () => {
    if (!selectedUser) return;

    try {
      const updatedUsers = users.map(u =>
        u.id === selectedUser.id
          ? {
              ...u,
              displayName: formData.displayName,
              email: formData.email,
              role: formData.role,
              permissions: getRolePermissions(formData.role)
            }
          : u
      );

      localStorage.setItem('icn_users', JSON.stringify(updatedUsers));
      loadUsers();
      setIsEditModalOpen(false);
      setSelectedUser(null);
      resetFormData();

      sonnerToast.success('User Updated', {
        description: 'User information has been updated'
      });
    } catch (error: any) {
      sonnerToast.error('Update Failed', {
        description: error.message
      });
    }
  };

  const handleDeleteUser = (user: User) => {
    const currentUser = getCurrentUser();

    if (user.id === currentUser?.id) {
      sonnerToast.error('Cannot Delete', {
        description: 'You cannot delete your own account'
      });
      return;
    }

    if (!confirm(`Delete user "${user.displayName}"? This cannot be undone.`)) {
      return;
    }

    try {
      const updatedUsers = users.filter(u => u.id !== user.id);
      localStorage.setItem('icn_users', JSON.stringify(updatedUsers));

      const passwords = JSON.parse(localStorage.getItem('icn_passwords') || '{}');
      delete passwords[user.username];
      localStorage.setItem('icn_passwords', JSON.stringify(passwords));

      loadUsers();

      sonnerToast.success('User Deleted', {
        description: `${user.displayName} has been removed`
      });
    } catch (error: any) {
      sonnerToast.error('Deletion Failed', {
        description: error.message
      });
    }
  };

  const handleChangePassword = () => {
    try {
      if (!passwordData.newPassword || !passwordData.confirmPassword) {
        sonnerToast.error('Validation Error', {
          description: 'All fields are required'
        });
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        sonnerToast.error('Validation Error', {
          description: 'Passwords do not match'
        });
        return;
      }

      if (passwordData.newPassword.length < 8) {
        sonnerToast.error('Validation Error', {
          description: 'Password must be at least 8 characters'
        });
        return;
      }

      const currentUser = getCurrentUser();
      if (currentUser) {
        changePassword(
          currentUser.username,
          passwordData.currentPassword,
          passwordData.newPassword
        );

        setIsPasswordModalOpen(false);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });

        sonnerToast.success('Password Changed', {
          description: 'Your password has been updated'
        });
      }
    } catch (error: any) {
      sonnerToast.error('Password Change Failed', {
        description: error.message
      });
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      password: '',
      confirmPassword: ''
    });
    setIsEditModalOpen(true);
  };

  const resetFormData = () => {
    setFormData({
      username: '',
      displayName: '',
      email: '',
      role: 'readonly',
      password: '',
      confirmPassword: ''
    });
  };

  const getRolePermissions = (role: User['role']): Permission[] => {
    const permissions: Record<User['role'], Permission[]> = {
      admin: ['view_ip_cases', 'create_ip_cases', 'edit_ip_cases', 'delete_ip_cases', 'view_abt', 'create_abt', 'edit_abt', 'view_vax', 'create_vax', 'edit_vax', 'view_census', 'edit_census', 'view_reports', 'manage_users', 'manage_settings'],
      infection_preventionist: ['view_ip_cases', 'create_ip_cases', 'edit_ip_cases', 'view_abt', 'create_abt', 'edit_abt', 'view_vax', 'create_vax', 'edit_vax', 'view_census', 'edit_census', 'view_reports'],
      nurse: ['view_ip_cases', 'view_abt', 'view_vax', 'create_vax', 'edit_vax', 'view_census'],
      readonly: ['view_ip_cases', 'view_abt', 'view_vax', 'view_census', 'view_reports']
    };
    return permissions[role];
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      infection_preventionist: 'bg-blue-100 text-blue-800',
      nurse: 'bg-green-100 text-green-800',
      readonly: 'bg-gray-100 text-gray-800'
    };

    return (
      <Badge className={`${colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800'} flex items-center gap-1`}>
        <Shield className="w-3 h-3" />
        {role.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage user accounts and permissions
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsPasswordModalOpen(true)} variant="outline">
            <Key className="w-4 h-4 mr-2" />
            Change Password
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === 'admin').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">IPs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === 'infection_preventionist').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Nurses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === 'nurse').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono text-sm">{user.username}</TableCell>
                  <TableCell className="font-medium">{user.displayName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell className="text-xs">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-xs">
                    {user.lastLogin
                      ? new Date(user.lastLogin).toLocaleString()
                      : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(user)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(user)}
                        disabled={user.id === getCurrentUser()?.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Enter username"
              />
            </div>

            <div>
              <Label htmlFor="displayName">Display Name *</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="Enter full name"
              />
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email"
              />
            </div>

            <div>
              <Label htmlFor="role">Role *</Label>
              <Select value={formData.role} onValueChange={(value: User['role']) => setFormData({ ...formData, role: value })}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="infection_preventionist">Infection Preventionist</SelectItem>
                  <SelectItem value="nurse">Nurse</SelectItem>
                  <SelectItem value="readonly">Read-Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter password (min 8 characters)"
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Re-enter password"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setIsCreateModalOpen(false); resetFormData(); }}>
                Cancel
              </Button>
              <Button onClick={handleCreateUser}>
                Create User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Username</Label>
              <Input value={formData.username} disabled />
            </div>

            <div>
              <Label htmlFor="editDisplayName">Display Name *</Label>
              <Input
                id="editDisplayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="editEmail">Email *</Label>
              <Input
                id="editEmail"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="editRole">Role *</Label>
              <Select value={formData.role} onValueChange={(value: User['role']) => setFormData({ ...formData, role: value })}>
                <SelectTrigger id="editRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="infection_preventionist">Infection Preventionist</SelectItem>
                  <SelectItem value="nurse">Nurse</SelectItem>
                  <SelectItem value="readonly">Read-Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setIsEditModalOpen(false); setSelectedUser(null); resetFormData(); }}>
                Cancel
              </Button>
              <Button onClick={handleUpdateUser}>
                Update User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Current Password *</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="newPassword">New Password *</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                placeholder="Min 8 characters"
              />
            </div>

            <div>
              <Label htmlFor="confirmNewPassword">Confirm New Password *</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setIsPasswordModalOpen(false); setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' }); }}>
                Cancel
              </Button>
              <Button onClick={handleChangePassword}>
                Change Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagementView;
