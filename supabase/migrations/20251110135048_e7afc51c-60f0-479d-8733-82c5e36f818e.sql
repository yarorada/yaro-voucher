-- Create a view that joins vouchers with user emails from auth.users
CREATE OR REPLACE VIEW public.vouchers_with_user AS
SELECT 
  v.*,
  u.email as creator_email
FROM public.vouchers v
LEFT JOIN auth.users u ON v.user_id = u.id;

-- Grant access to authenticated users
GRANT SELECT ON public.vouchers_with_user TO authenticated;