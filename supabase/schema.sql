-- ==============================================================================
-- Musubi - Database Schema (Supabase / PostgreSQL)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    age INTEGER,
    age_group TEXT CHECK (age_group IN ('18-29', '30-49', '50-64', '65+')),
    location TEXT NOT NULL DEFAULT '',
    neighborhoods TEXT[] DEFAULT '{}',
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    bio TEXT NOT NULL DEFAULT '',
    interests TEXT[] DEFAULT '{}',
    skills TEXT[] DEFAULT '{}',
    services_offered TEXT[] DEFAULT '{}',
    services_needed TEXT[] DEFAULT '{}',
    availability TEXT NOT NULL DEFAULT 'Flexible',
    contact_method TEXT NOT NULL CHECK (contact_method IN ('chat', 'phone')) DEFAULT 'chat',
    phone TEXT,
    user_group TEXT NOT NULL CHECK (user_group IN ('og', 'yg')),
    is_admin BOOLEAN NOT NULL DEFAULT false,
    is_banned BOOLEAN NOT NULL DEFAULT false,
    ban_reason TEXT,
    warnings_count INTEGER NOT NULL DEFAULT 0,
    last_active_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    verification_status TEXT NOT NULL CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')) DEFAULT 'unverified',
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Skills & Needs normalized tables (optional for fine-grained search)
CREATE TABLE IF NOT EXISTS public.skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.needs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Requirement Templates (Quick-post templates for older users)
CREATE TABLE IF NOT EXISTS public.requirement_templates (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('Cooking', 'Technology', 'Arts & Crafts', 'Gardening', 'Daily Assistance', 'Companionship', 'Community & Local Activities')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    suggested_exchange TEXT NOT NULL CHECK (suggested_exchange IN ('free', 'exchange', 'paid')),
    skill TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Posts Table
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Cooking', 'Technology', 'Arts & Crafts', 'Gardening', 'Daily Assistance', 'Companionship', 'Community & Local Activities')),
    skill TEXT NOT NULL,
    location TEXT NOT NULL,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    availability TEXT NOT NULL,
    post_type TEXT NOT NULL CHECK (post_type IN ('offer', 'request')),
    exchange_method TEXT NOT NULL CHECK (exchange_method IN ('free', 'exchange', 'paid')),
    amount NUMERIC(10, 2),
    status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'completed', 'closed')) DEFAULT 'open',
    template_id TEXT REFERENCES public.requirement_templates(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Service Requests Table
CREATE TABLE IF NOT EXISTS public.service_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'completed')) DEFAULT 'pending',
    direct BOOLEAN NOT NULL DEFAULT false,
    requester_done BOOLEAN NOT NULL DEFAULT false,
    owner_done BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Conversations Table (Created once a service request is accepted)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL UNIQUE REFERENCES public.service_requests(id) ON DELETE CASCADE,
    participant_ids UUID[] NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('request_new', 'request_accepted', 'request_rejected', 'message', 'activity', 'completed', 'review', 'payment', 'connection_request', 'connection_accepted', 'direct_message', 'warning', 'verification_approved', 'verification_rejected')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    href TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. Transactions Table (Demo Simulated Payments)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
    payer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    payee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'successful', 'failed')) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. Activities Table (Historical record of completed exchanges)
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
    participant_ids UUID[] NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. Reviews Table (Submitted after activity completion)
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment VARCHAR(200) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_reviewer_per_activity UNIQUE (activity_id, reviewer_id)
);

-- 12. Reports Table (Safety & Moderation)
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'user')),
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'resolved_deleted', 'resolved_warned', 'resolved_banned', 'dismissed_fake')) DEFAULT 'pending',
    resolution_note TEXT,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. Blocks Table (User Safety & Blocking)
CREATE TABLE IF NOT EXISTS public.blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id)
);

-- 14. Profile Verifications Table (Document verification requests)
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

-- 15. User Warnings Table (Admin moderation warnings)
CREATE TABLE IF NOT EXISTS public.user_warnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    issued_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;

-- Helper function to check admin role without RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Profiles: Public read (phone/sensitive data hidden in view or API layer), user update own
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Posts: Viewable by anyone, created by authenticated users, edited/deleted by author
CREATE POLICY "Posts are viewable by everyone" ON public.posts
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create posts" ON public.posts
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own posts" ON public.posts
    FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete own posts" ON public.posts
    FOR DELETE USING (auth.uid() = author_id);

-- Requirement Templates: Viewable by everyone
CREATE POLICY "Templates viewable by everyone" ON public.requirement_templates
    FOR SELECT USING (true);

-- Service Requests: Participants can see, requester can create, owner can accept/reject
CREATE POLICY "Users can view their own requests" ON public.service_requests
    FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = owner_id);

CREATE POLICY "Users can insert requests (not for own posts)" ON public.service_requests
    FOR INSERT WITH CHECK (auth.uid() = requester_id AND requester_id <> owner_id);

CREATE POLICY "Participants can update requests" ON public.service_requests
    FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = owner_id);

-- Conversations & Messages: Accessible only by conversation participants
CREATE POLICY "Participants can view conversations" ON public.conversations
    FOR SELECT USING (auth.uid() = ANY(participant_ids));

CREATE POLICY "Participants can create conversations" ON public.conversations
    FOR INSERT WITH CHECK (auth.uid() = ANY(participant_ids));

CREATE POLICY "Participants can view messages" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id AND auth.uid() = ANY(c.participant_ids)
        )
    );

CREATE POLICY "Participants can send messages" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id AND auth.uid() = ANY(c.participant_ids)
        )
    );

-- Notifications: Only target user can view and update, authenticated users can send notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert notifications" ON public.notifications
    FOR INSERT WITH CHECK (true);

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Activities: Participants can view and create completed activities
CREATE POLICY "Participants can view activities" ON public.activities
    FOR SELECT USING (auth.uid() = ANY(participant_ids));

CREATE POLICY "Participants can insert activities" ON public.activities
    FOR INSERT WITH CHECK (auth.uid() = ANY(participant_ids));

-- Reviews: Anyone can view, participants of completed activity can insert
CREATE POLICY "Reviews viewable by everyone" ON public.reviews
    FOR SELECT USING (true);

CREATE POLICY "Completed activity participants can create review" ON public.reviews
    FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- Transactions: Payer and Payee can view, payer can insert, participants can update
CREATE POLICY "Payer and payee can view transactions" ON public.transactions
    FOR SELECT USING (auth.uid() = payer_id OR auth.uid() = payee_id);

CREATE POLICY "Payer can insert transactions" ON public.transactions
    FOR INSERT WITH CHECK (auth.uid() = payer_id);

CREATE POLICY "Participants can update transactions" ON public.transactions
    FOR UPDATE USING (auth.uid() = payer_id OR auth.uid() = payee_id);

-- Reports & Blocks
CREATE POLICY "Users can create reports" ON public.reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can view and update reports" ON public.reports
    FOR ALL USING (public.is_admin());

CREATE POLICY "Admins can delete any post" ON public.posts
    FOR DELETE USING (public.is_admin());

CREATE POLICY "Admins can update any profile" ON public.profiles
    FOR UPDATE USING (public.is_admin());

CREATE POLICY "Users can manage blocks" ON public.blocks
    FOR ALL USING (auth.uid() = blocker_id);

-- Profile Verifications
CREATE POLICY "Users can submit own verification" ON public.profile_verifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own verifications or admins all" ON public.profile_verifications
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can update verifications" ON public.profile_verifications
    FOR UPDATE USING (public.is_admin());

-- User Warnings
CREATE POLICY "Users can view own warnings or admins all" ON public.user_warnings
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can issue warnings" ON public.user_warnings
    FOR INSERT WITH CHECK (public.is_admin());

-- Realtime publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ==============================================================================
-- SEED REQUIREMENT TEMPLATES (Quick-post presets)
-- ==============================================================================
INSERT INTO public.requirement_templates (id, category, title, description, suggested_exchange, skill)
VALUES
  ('tpl-cook-offer', 'Cooking', 'Traditional Japanese Cooking Lessons', 'I can share family recipes, dashi stock preparation, and seasonal home-style Japanese cooking.', 'exchange', 'Japanese Cooking'),
  ('tpl-cook-request', 'Cooking', 'Learn Japanese Home Cooking', 'Looking for an experienced neighbor to teach me traditional home recipes and meal seasoning.', 'exchange', 'Cooking Lessons'),
  ('tpl-tech-offer', 'Technology', 'Smartphone & Tablet Guidance', 'Patient, step-by-step assistance with smartphone setup, line messaging, camera tips, and apps.', 'free', 'Smartphone Guidance'),
  ('tpl-tech-request', 'Technology', 'Looking for Smartphone Assistance', 'I would appreciate patient help learning video calls on Zoom and organizing photo albums on my phone.', 'free', 'Smartphone Assistance'),
  ('tpl-craft-offer', 'Arts & Crafts', 'Traditional Origami Lessons', 'I can teach origami folding techniques from classic peace cranes to decorative seasonal crafts.', 'free', 'Origami'),
  ('tpl-craft-request', 'Arts & Crafts', 'Learn Traditional Japanese Calligraphy', 'Eager to learn brush calligraphy (Shodo) basics and kanji stroke techniques from a master.', 'exchange', 'Calligraphy'),
  ('tpl-garden-offer', 'Gardening', 'Balcony Plant Care & Gardening Wisdom', 'Experienced in small-space gardening, bonsai trimming, and vegetable care. Glad to share tips.', 'exchange', 'Plant Care'),
  ('tpl-garden-request', 'Gardening', 'Help with Garden Weeding & Pruning', 'Need an energetic helping hand with seasonal garden cleaning, weeding, and moving flowerpots.', 'free', 'Garden Weeding'),
  ('tpl-daily-offer', 'Daily Assistance', 'Grocery Pickup & Neighborhood Errands', 'I can pick up groceries, packages, or daily necessities during my regular supermarket runs.', 'free', 'Grocery Errands'),
  ('tpl-daily-request', 'Daily Assistance', 'Grocery Shopping & Errand Support', 'Help buying heavy groceries and carrying bags home from the local market safely.', 'free', 'Grocery Shopping'),
  ('tpl-companion-offer', 'Companionship', 'Afternoon Tea & Relaxed Conversation', 'Happy to sit down for a warm cup of green tea, listen to memories, and share pleasant conversation.', 'free', 'Friendly Conversation'),
  ('tpl-companion-request', 'Companionship', 'Looking for a Walking Companion', 'Seeking a friendly walking partner for short, relaxed morning strolls along pleasant neighborhood streets.', 'free', 'Walking Companion'),
  ('tpl-community-offer', 'Community & Local Activities', 'Neighborhood Walking Tour & Cultural History', 'I love sharing the history, local shrines, and hidden spots of our neighborhood with interested neighbors.', 'free', 'Local History & Culture'),
  ('tpl-community-request', 'Community & Local Activities', 'Join Neighborhood Events & Group Activities', 'Looking for friendly neighbors to join local festivals, community gardening, or neighborhood group activities together.', 'free', 'Community Events')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  suggested_exchange = EXCLUDED.suggested_exchange,
  skill = EXCLUDED.skill;


-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    age,
    age_group,
    location,
    neighborhoods,
    user_group,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    (NEW.raw_user_meta_data->>'age')::INTEGER,
    NEW.raw_user_meta_data->>'age_group',
    COALESCE(NEW.raw_user_meta_data->>'location', ''),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'neighborhoods')), '{}'::TEXT[]),
    COALESCE(NEW.raw_user_meta_data->>'user_group', 'yg'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

