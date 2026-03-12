import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rirsmtyuyqxsoxqbgtpu.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpcnNtdHl1eXF4c294cWJndHB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTE0NTksImV4cCI6MjA4ODkyNzQ1OX0.040q_WnTtxwuv6kdgS8GuYpx9QNWln3bdnPmNpcO7wc'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
