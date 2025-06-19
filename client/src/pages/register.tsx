import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterData } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [, setLocation] = useLocation();
  const { register: registerUser } = useAuth();
  const { toast } = useToast();

  const form = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      companyName: '',
      role: 'admin',
      vacationDaysTotal: 20,
      vacationDaysUsed: 0,
      isActive: true,
    },
  });

  const onSubmit = async (data: RegisterData) => {
    try {
      await registerUser(data);
      setLocation('/dashboard');
      toast({
        title: 'Account Created!',
        description: 'Welcome to Oficaz! Your account has been successfully created.',
      });
    } catch (error: any) {
      toast({
        title: 'Registration Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-oficaz-gray-50 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-oficaz-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Building className="text-white text-2xl" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Create Your Account</CardTitle>
          <CardDescription>Get started with Oficaz for your business</CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  {...form.register('firstName')}
                  placeholder="First name"
                  className="mt-1"
                />
                {form.formState.errors.firstName && (
                  <p className="text-sm text-oficaz-error mt-1">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  {...form.register('lastName')}
                  placeholder="Last name"
                  className="mt-1"
                />
                {form.formState.errors.lastName && (
                  <p className="text-sm text-oficaz-error mt-1">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                {...form.register('companyName')}
                placeholder="Your company name"
                className="mt-1"
              />
              {form.formState.errors.companyName && (
                <p className="text-sm text-oficaz-error mt-1">
                  {form.formState.errors.companyName.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...form.register('email')}
                placeholder="your@email.com"
                className="mt-1"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-oficaz-error mt-1">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                {...form.register('username')}
                placeholder="Choose a username"
                className="mt-1"
              />
              {form.formState.errors.username && (
                <p className="text-sm text-oficaz-error mt-1">
                  {form.formState.errors.username.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...form.register('password')}
                  placeholder="Create a password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-sm text-oficaz-error mt-1">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative mt-1">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...form.register('confirmPassword')}
                  placeholder="Confirm your password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-oficaz-error mt-1">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/login">
                <a className="font-medium text-oficaz-primary hover:text-blue-500">
                  Sign in
                </a>
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
