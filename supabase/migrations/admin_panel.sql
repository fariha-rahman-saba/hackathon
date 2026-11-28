-- ==============================================================================
-- Musubi Admin Panel & Profile Verification Migration (Idempotent)
-- Safe to run on an existing Supabase database.
-- ==============================================================================

-- 1. Extend profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT,
  ADD COLUMN IF NOT EXISTS warnings_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_verification_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_verification_status_check
  CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'));

-- 2. Extend notifications type check constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'request_new', 'request_accepted', 'request_rejected', 'message',
    'activity', 'completed', 'review', 'payment',
    'connection_request', 'connection_accepted', 'direct_message',
    'warning', 'verification_approved', 'verification_rejected'
  ));

-- 3. Extend reports table
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS resolution_note TEXT,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_status_check
  CHECK (status IN ('pending', 'resolved_deleted', 'resolved_warned', 'resolved_banned', 'dismissed_fake'));

-- 4. Create Profile Verifications table
CREATE TABLE IF NOT EXISTS public.profile_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('national_id', 'passport', 'student_id', 'senior_card', 'other')),
  document_url TEXT NOT NULL,
  document_name TEXT NOT NULL DEFAULT 'document',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Create User Warnings table
CREATE TABLE IF NOT EXISTS public.user_warnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issued_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Enable RLS on new tables
ALTER TABLE public.profile_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;

-- 7. Admin helper function (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 8. Admin & Verification RLS Policies (drop if exists first)
DROP POLICY IF EXISTS "Admins can view and update reports" ON public.reports;
CREATE POLICY "Admins can view and update reports" ON public.reports
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete any post" ON public.posts;
CREATE POLICY "Admins can delete any post" ON public.posts
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Users can submit own verification" ON public.profile_verifications;
CREATE POLICY "Users can submit own verification" ON public.profile_verifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own verifications or admins all" ON public.profile_verifications;
CREATE POLICY "Users can view own verifications or admins all" ON public.profile_verifications
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can update verifications" ON public.profile_verifications;
CREATE POLICY "Admins can update verifications" ON public.profile_verifications
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view own warnings or admins all" ON public.user_warnings;
CREATE POLICY "Users can view own warnings or admins all" ON public.user_warnings
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can issue warnings" ON public.user_warnings;
CREATE POLICY "Admins can issue warnings" ON public.user_warnings
  FOR INSERT WITH CHECK (public.is_admin());
