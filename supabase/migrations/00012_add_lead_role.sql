-- Add 'lead' role for camp leads who need visibility into BM deadlines
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('member', 'lead', 'committee', 'admin', 'super_admin'));
