import { useState, useEffect } from 'react'
import { supabase, type Contact, type Occasion, type Message } from './lib/supabase'
import type { User } from '@supabase/supabase-js'
import { Send, Users, Calendar, MessageSquare, LogOut, Plus, Edit2, Trash2, X } from 'lucide-react'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  
  // App state
  const [contacts, setContacts] = useState<Contact[]>([])
  const [occasions, setOccasions] = useState<Occasion[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [activeTab, setActiveTab] = useState<'generate' | 'contacts' | 'occasions'>('generate')
  
  // Form states
  const [selectedContact, setSelectedContact] = useState<string>('')
  const [selectedOccasion, setSelectedOccasion] = useState<string>('')
  const [messageStyle, setMessageStyle] = useState<'formal' | 'casual' | 'warm'>('warm')
  const [generatedMessages, setGeneratedMessages] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  // Contact form states
  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [contactForm, setContactForm] = useState({
    name: '',
    phone_number: '',
    relationship_tier: 'friends' as Contact['relationship_tier'],
    notes: ''
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    if (!user) return

    const [contactsRes, occasionsRes, messagesRes] = await Promise.all([
      supabase.from('contacts').select('*').eq('user_id', user.id).order('name'),
      supabase.from('occasions').select('*').eq('user_id', user.id).order('date'),
      supabase.from('messages').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
    ])

    if (contactsRes.data) setContacts(contactsRes.data)
    if (occasionsRes.data) setOccasions(occasionsRes.data)
    if (messagesRes.data) setMessages(messagesRes.data)
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        alert('Check your email for confirmation link!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (error: any) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const openContactForm = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact)
      setContactForm({
        name: contact.name,
        phone_number: contact.phone_number,
        relationship_tier: contact.relationship_tier,
        notes: contact.notes || ''
      })
    } else {
      setEditingContact(null)
      setContactForm({
        name: '',
        phone_number: '',
        relationship_tier: 'friends',
        notes: ''
      })
    }
    setShowContactForm(true)
  }

  const closeContactForm = () => {
    setShowContactForm(false)
    setEditingContact(null)
    setContactForm({
      name: '',
      phone_number: '',
      relationship_tier: 'friends',
      notes: ''
    })
  }

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      if (editingContact) {
        // Update existing contact
        const { error } = await supabase
          .from('contacts')
          .update({
            name: contactForm.name,
            phone_number: contactForm.phone_number,
            relationship_tier: contactForm.relationship_tier,
            notes: contactForm.notes
          })
          .eq('id', editingContact.id)

        if (error) throw error
        alert('Contact updated!')
      } else {
        // Create new contact
        const { error } = await supabase
          .from('contacts')
          .insert({
            name: contactForm.name,
            phone_number: contactForm.phone_number,
            relationship_tier: contactForm.relationship_tier,
            notes: contactForm.notes,
            user_id: user.id
          })

        if (error) throw error
        alert('Contact added!')
      }

      closeContactForm()
      loadData()
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId)

      if (error) throw error
      alert('Contact deleted!')
      loadData()
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  const generateMessages = async () => {
    if (!selectedContact) {
      alert('Please select a contact')
      return
    }

    setIsGenerating(true)
    
    const contact = contacts.find(c => c.id === selectedContact)
    const occasion = occasions.find(o => o.id === selectedOccasion)
    
    try {
      const prompt = `Generate 3 ${messageStyle} text message variations for ${contact?.name}${occasion ? ` for ${occasion.occasion_name}` : ' just to check in'}. 
      
Relationship: ${contact?.relationship_tier.replace('_', ' ')}
Style: ${messageStyle}

Return ONLY a JSON array of 3 strings, no other text:
["message 1", "message 2", "message 3"]`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      })

      const data = await response.json()
      const messageText = data.content[0].text
      const parsed = JSON.parse(messageText)
      setGeneratedMessages(parsed)
      
    } catch (error) {
      console.error('Error generating messages:', error)
      const fallbackMessages = [
        `Hey ${contact?.name}! ${occasion ? `Happy ${occasion.occasion_name}!` : 'Just wanted to check in and see how you\'re doing.'} Hope all is well! 😊`,
        `Hi ${contact?.name}, ${occasion ? `wishing you a wonderful ${occasion.occasion_name}` : 'thinking of you today'}. Let's catch up soon!`,
        `${contact?.name}! ${occasion ? `Have an amazing ${occasion.occasion_name}!` : 'Hope you\'re having a great day.'} Miss you! 💙`
      ]
      setGeneratedMessages(fallbackMessages)
    } finally {
      setIsGenerating(false)
    }
  }

  const saveAndSendMessage = async (messageText: string) => {
    if (!user || !selectedContact) return

    const contact = contacts.find(c => c.id === selectedContact)
    
    try {
      await supabase.from('messages').insert({
        contact_id: selectedContact,
        occasion_id: selectedOccasion || null,
        message_text: messageText,
        style: messageStyle,
        status: 'sent',
        sent_at: new Date().toISOString(),
        user_id: user.id
      })

      await navigator.clipboard.writeText(messageText)
      
      alert(`Message copied to clipboard! Now open your Android Messages app and send to ${contact?.phone_number}`)
      
      loadData()
      setGeneratedMessages([])
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  const formatRelationship = (tier: string) => {
    return tier.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-md">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 text-center">
            Personal Message Assistant
          </h1>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {authMode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
            <button
              type="button"
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="w-full text-blue-600 hover:text-blue-700 text-sm"
            >
              {authMode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto p-2 sm:p-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-4 sm:mb-6 flex justify-between items-center">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-800">Personal Message Assistant</h1>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm sm:text-base"
          >
            <LogOut size={18} className="sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-4 sm:mb-6">
          <div className="flex border-b overflow-x-auto">
            <button
              onClick={() => setActiveTab('generate')}
              className={`flex-1 min-w-[100px] py-3 sm:py-4 px-3 sm:px-6 flex items-center justify-center gap-2 font-medium transition-colors text-sm sm:text-base ${
                activeTab === 'generate'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <MessageSquare size={18} className="sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Generate</span>
            </button>
            <button
              onClick={() => setActiveTab('contacts')}
              className={`flex-1 min-w-[100px] py-3 sm:py-4 px-3 sm:px-6 flex items-center justify-center gap-2 font-medium transition-colors text-sm sm:text-base ${
                activeTab === 'contacts'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Users size={18} className="sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Contacts</span>
              <span className="sm:hidden">({contacts.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('occasions')}
              className={`flex-1 min-w-[100px] py-3 sm:py-4 px-3 sm:px-6 flex items-center justify-center gap-2 font-medium transition-colors text-sm sm:text-base ${
                activeTab === 'occasions'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Calendar size={18} className="sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Occasions</span>
              <span className="sm:hidden">({occasions.length})</span>
            </button>
          </div>
        </div>

        {/* Generate Messages Tab */}
        {activeTab === 'generate' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6">Generate Message</h2>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Contact</label>
                  <select
                    value={selectedContact}
                    onChange={(e) => setSelectedContact(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Choose a contact...</option>
                    {contacts.map(contact => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} ({formatRelationship(contact.relationship_tier)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Occasion (Optional)
                  </label>
                  <select
                    value={selectedOccasion}
                    onChange={(e) => setSelectedOccasion(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Just checking in</option>
                    {occasions
                      .filter(o => o.contact_id === selectedContact)
                      .map(occasion => (
                        <option key={occasion.id} value={occasion.id}>
                          {occasion.occasion_name} ({occasion.date})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message Style</label>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {(['formal', 'casual', 'warm'] as const).map(style => (
                      <button
                        key={style}
                        onClick={() => setMessageStyle(style)}
                        className={`py-2 px-4 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                          messageStyle === style
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {style.charAt(0).toUpperCase() + style.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={generateMessages}
                  disabled={!selectedContact || isGenerating}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>Generating...</>
                  ) : (
                    <>
                      <MessageSquare size={20} />
                      Generate 3 Message Options
                    </>
                  )}
                </button>
              </div>

              {/* Generated Messages */}
              {generatedMessages.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">Choose a message to send:</h3>
                  {generatedMessages.map((msg, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                      <p className="text-gray-700 mb-3 text-sm sm:text-base">{msg}</p>
                      <button
                        onClick={() => saveAndSendMessage(msg)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base"
                      >
                        <Send size={18} />
                        Copy & Send This One
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Messages */}
            {messages.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Recent Messages</h2>
                <div className="space-y-3">
                  {messages.map((message) => {
                    const contact = contacts.find(c => c.id === message.contact_id)
                    return (
                      <div key={message.id} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold text-gray-800 text-sm sm:text-base">{contact?.name}</p>
                            <p className="text-xs sm:text-sm text-gray-500">{message.sent_at ? formatDate(message.sent_at) : 'Draft'}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            message.style === 'formal' ? 'bg-purple-100 text-purple-800' :
                            message.style === 'casual' ? 'bg-green-100 text-green-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {message.style}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm sm:text-base">{message.message_text}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contacts Tab */}
        {activeTab === 'contacts' && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">Contacts</h2>
              <button
                onClick={() => openContactForm()}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
              >
                <Plus size={18} className="sm:w-5 sm:h-5" />
                Add Contact
              </button>
            </div>

            {contacts.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No contacts yet. Click "Add Contact" to get started!</p>
            ) : (
              <div className="grid gap-3 sm:gap-4">
                {contacts.map(contact => (
                  <div key={contact.id} className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:border-blue-300 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 text-base sm:text-lg">{contact.name}</h3>
                        <p className="text-sm sm:text-base text-gray-600">{contact.phone_number}</p>
                        <p className="text-xs sm:text-sm text-gray-500">{formatRelationship(contact.relationship_tier)}</p>
                        {contact.notes && <p className="text-xs sm:text-sm text-gray-600 mt-1 italic">{contact.notes}</p>}
                      </div>
                      <div className="flex gap-2 ml-2">
                        <button
                          onClick={() => openContactForm(contact)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Occasions Tab */}
        {activeTab === 'occasions' && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6">Occasions</h2>
            <p className="text-gray-600 text-sm sm:text-base">Occasion management coming soon. For now, add occasions directly in your Supabase dashboard.</p>
          </div>
        )}
      </div>

      {/* Contact Form Modal */}
      {showContactForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                {editingContact ? 'Edit Contact' : 'Add Contact'}
              </h3>
              <button
                onClick={closeContactForm}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  value={contactForm.phone_number}
                  onChange={(e) => setContactForm({ ...contactForm, phone_number: e.target.value })}
                  placeholder="+1234567890"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Relationship *</label>
                <select
                  value={contactForm.relationship_tier}
                  onChange={(e) => setContactForm({ ...contactForm, relationship_tier: e.target.value as Contact['relationship_tier'] })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="close_family">Close Family</option>
                  <option value="extended_family">Extended Family</option>
                  <option value="close_friends">Close Friends</option>
                  <option value="friends">Friends</option>
                  <option value="professional">Professional</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={contactForm.notes}
                  onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Birthday, preferences, last conversation topics..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeContactForm}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingContact ? 'Update' : 'Add'} Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
