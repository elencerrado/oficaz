import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Settings as SettingsIcon, 
  User, 
  Building, 
  Clock, 
  Shield,
  Save,
  Upload
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const { user, company, logout } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // User settings state
  const [userSettings, setUserSettings] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Company settings state (admin only)
  const [companySettings, setCompanySettings] = useState({
    name: company?.name || '',
    workingHoursStart: company?.workingHoursStart || '09:00',
    workingHoursEnd: company?.workingHoursEnd || '17:00',
  });

  const handleUserSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Simulate API call - in real implementation, this would update user profile
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update your profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (userSettings.newPassword !== userSettings.confirmPassword) {
      toast({
        title: 'Password Mismatch',
        description: 'New password and confirmation do not match.',
        variant: 'destructive',
      });
      return;
    }

    if (userSettings.newPassword.length < 6) {
      toast({
        title: 'Password Too Short',
        description: 'Password must be at least 6 characters long.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Simulate API call - in real implementation, this would update password
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast({
        title: 'Password Updated',
        description: 'Your password has been updated successfully.',
      });

      setUserSettings(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update your password. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanySettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Simulate API call - in real implementation, this would update company settings
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast({
        title: 'Company Settings Updated',
        description: 'Company settings have been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update company settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">
          Manage your account and company preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Summary */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="mr-2" size={20} />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <Avatar className="w-20 h-20 mx-auto mb-4">
                  <AvatarFallback className="bg-oficaz-primary text-white text-2xl">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <h3 className="font-semibold text-gray-900">
                  {user?.firstName} {user?.lastName}
                </h3>
                <p className="text-sm text-gray-500">{user?.email}</p>
                <Badge className="mt-2 capitalize">
                  {user?.role}
                </Badge>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Company</span>
                  <span className="font-medium">{company?.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Vacation Days</span>
                  <span className="font-medium">
                    {(user?.vacationDaysTotal || 0) - (user?.vacationDaysUsed || 0)}/{user?.vacationDaysTotal} left
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Member Since</span>
                  <span className="font-medium">
                    {user?.createdAt && new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUserSettingsSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={userSettings.firstName}
                      onChange={(e) => setUserSettings(prev => ({ ...prev, firstName: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={userSettings.lastName}
                      onChange={(e) => setUserSettings(prev => ({ ...prev, lastName: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={userSettings.email}
                    onChange={(e) => setUserSettings(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-oficaz-primary hover:bg-blue-700"
                >
                  <Save className="mr-2" size={16} />
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Password Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={userSettings.currentPassword}
                    onChange={(e) => setUserSettings(prev => ({ ...prev, currentPassword: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={userSettings.newPassword}
                    onChange={(e) => setUserSettings(prev => ({ ...prev, newPassword: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={userSettings.confirmPassword}
                    onChange={(e) => setUserSettings(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    required
                  />
                </div>
                
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-oficaz-primary hover:bg-blue-700"
                >
                  <Shield className="mr-2" size={16} />
                  {isLoading ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Company Settings (Admin only) */}
          {user?.role === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building className="mr-2" size={20} />
                  Company Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCompanySettingsSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={companySettings.name}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="workingHoursStart">Work Start Time</Label>
                      <Input
                        id="workingHoursStart"
                        type="time"
                        value={companySettings.workingHoursStart}
                        onChange={(e) => setCompanySettings(prev => ({ ...prev, workingHoursStart: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="workingHoursEnd">Work End Time</Label>
                      <Input
                        id="workingHoursEnd"
                        type="time"
                        value={companySettings.workingHoursEnd}
                        onChange={(e) => setCompanySettings(prev => ({ ...prev, workingHoursEnd: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="companyLogo">Company Logo</Label>
                    <div className="mt-2 flex items-center space-x-4">
                      <div className="w-16 h-16 bg-oficaz-primary rounded-lg flex items-center justify-center">
                        <Building className="text-white" size={24} />
                      </div>
                      <Button type="button" variant="outline">
                        <Upload className="mr-2" size={16} />
                        Upload Logo
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Recommended: Square image, at least 200x200px
                    </p>
                  </div>
                  
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="bg-oficaz-primary hover:bg-blue-700"
                  >
                    <Save className="mr-2" size={16} />
                    {isLoading ? 'Saving...' : 'Save Company Settings'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Sign Out</h4>
                  <p className="text-sm text-gray-500 mb-3">
                    Sign out of your account on this device.
                  </p>
                  <Button
                    variant="outline"
                    onClick={logout}
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    Sign Out
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
