import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our database
export interface Contact {
  id: string
  name: string
  phone_number: string
  relationship_tier: 'close_family' | 'extended_family' | 'close_friends' | 'friends' | 'professional'
  notes?: string
  created_at: string
  user_id: string
}

export interface Occasion {
  id: string
  contact_id: string
  occasion_type: 'birthday' | 'holiday' | 'just_checking_in' | 'life_event'
  occasion_name: string
  date: string
  recurring: boolean
  created_at: string
  user_id: string
}

export interface Message {
  id: string
  contact_id: string
  occasion_id?: string
  message_text: string
  style: 'formal' | 'casual' | 'warm'
  sent_at?: string
  status: 'draft' | 'sent' | 'scheduled'
  created_at: string
  user_id: string
}
