import Groq from 'groq-sdk'
import { db } from '../lib/supabase'

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || ''
})

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface AIResponse {
  message: string
  data?: any
  action?: string
}

export class AIService {
  /**
   * Process a chat message and generate AI response
   */
  static async chat(
    messages: ChatMessage[],
    companyId: string,
    userId: string
  ): Promise<AIResponse> {
    try {
      // Get company and user context
      const context = await this.getContext(companyId, userId)

      // Build system prompt with context
      const systemPrompt = this.buildSystemPrompt(context)

      // Prepare messages for Groq API
      const groqMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
      ] as any[]

      // Call Groq API
      const completion = await groq.chat.completions.create({
        messages: groqMessages,
        model: 'llama-3.3-70b-versatile', // Latest model (replaces 3.1)
        temperature: 0.7,
        max_tokens: 1024,
      })

      const aiMessage = completion.choices[0]?.message?.content || 'Sorry, I could not process your request.'

      // Check if AI suggests an action
      const action = this.extractAction(aiMessage)

      return {
        message: aiMessage,
        action
      }
    } catch (error) {
      console.error('AI Service Error:', error)
      return {
        message: 'Sorry, I encountered an error. Please try again.',
      }
    }
  }

  /**
   * Get company and user context for AI (ENHANCED with actual data samples)
   */
  private static async getContext(companyId: string, userId: string) {
    try {
      // Get company data
      const { data: company } = await db.companies()
        .select('*')
        .eq('id', companyId)
        .single()

      // Get counts
      const { count: invoiceCount } = await db.invoices()
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)

      const { count: quoteCount } = await db.quotes()
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)

      const { count: customerCount } = await db.customers()
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)

      const { count: overdueCount } = await db.invoices()
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'OVERDUE')

      // Get recent customers (top 10)
      const { data: recentCustomers } = await db.customers()
        .select('id, name, city, email')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10)

      // Get recent invoices (top 10)
      const { data: recentInvoices } = await db.invoices()
        .select('id, number, status, total, issue_date, customers(name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(10)

      // Get revenue stats
      const { data: paidInvoices } = await db.invoices()
        .select('total')
        .eq('company_id', companyId)
        .eq('status', 'PAID')

      const totalRevenue = paidInvoices?.reduce((sum, inv) => sum + inv.total, 0) || 0

      // Get outstanding
      const { data: outstandingInvoices } = await db.invoices()
        .select('total')
        .eq('company_id', companyId)
        .in('status', ['OPEN', 'OVERDUE'])

      const totalOutstanding = outstandingInvoices?.reduce((sum, inv) => sum + inv.total, 0) || 0

      return {
        company,
        invoiceCount: invoiceCount || 0,
        quoteCount: quoteCount || 0,
        customerCount: customerCount || 0,
        overdueCount: overdueCount || 0,
        totalRevenue: totalRevenue / 100,
        totalOutstanding: totalOutstanding / 100,
        recentCustomers: recentCustomers || [],
        recentInvoices: recentInvoices || []
      }
    } catch (error) {
      console.error('Error getting context:', error)
      return null
    }
  }

  /**
   * Build system prompt with company context
   */
  private static buildSystemPrompt(context: any): string {
    if (!context) {
      return 'You are a helpful AI assistant for an invoice management system.'
    }

    return `You are an AI assistant for InvoSmart, a Swiss invoice management system.

**Company Context:**
- Company: ${context.company?.name || 'Unknown'}
- Total Invoices: ${context.invoiceCount}
- Total Quotes: ${context.quoteCount}
- Total Customers: ${context.customerCount}
- Overdue Invoices: ${context.overdueCount}
- Total Revenue: CHF ${context.totalRevenue?.toFixed(2) || '0.00'}
- Outstanding: CHF ${context.totalOutstanding?.toFixed(2) || '0.00'}

**Recent Customers (Sample):**
${context.recentCustomers?.slice(0, 5).map((c: any) => `- ${c.name} (${c.city || 'N/A'})`).join('\n') || 'No customers yet'}

**Recent Invoices (Sample):**
${context.recentInvoices?.slice(0, 5).map((i: any) => `- #${i.number}: ${i.customers?.name || 'N/A'} - CHF ${(i.total / 100).toFixed(2)} (${i.status})`).join('\n') || 'No invoices yet'}

**Your Role:**
- Help users manage invoices, quotes, customers, and payments
- Answer questions about their business data (customers, invoices, stats, etc.)
- Suggest actions like creating invoices, sending reminders, etc.
- Be professional, concise, and helpful
- Always format amounts in Swiss Francs (CHF)
- Use Swiss date format (DD.MM.YYYY) when displaying to users
- You can answer questions like:
  * "What customers start with A?"
  * "How many invoices do I have?"
  * "What's my revenue this month?"
  * "Show me customers in Zurich"
  * "Who owes me money?"

**Database Access:**
You have access to the company's database with these tables:
- **invoices**: id, company_id, customer_id, number, status (DRAFT/OPEN/PAID/OVERDUE/CANCELLED), issue_date, due_date, service_date, total, subtotal, vat_amount, notes
- **customers**: id, company_id, name, email, phone, address, city, zip, country, is_active
- **expenses**: id, company_id, user_id, title, description, amount, category, expense_date, status
- **quotes**: id, company_id, customer_id, number, status, total
- **payments**: id, company_id, invoice_id, amount, payment_date, reference

**You can answer ANY question by analyzing the database context provided. For data-heavy queries, use natural language - I'll help format the response.**

**Available Actions:**
You can perform actions by responding with a JSON block at the end of your message:

\`\`\`json
{
  "action": "CREATE_INVOICE" | "CREATE_EXPENSE" | "SHOW_OVERDUE" | "VIEW_STATS" | "CREATE_QUOTE" | "QUERY_DATA",
  "data": { /* relevant data */ }
}
\`\`\`

**Action Types:**

1. **CREATE_INVOICE**: When user wants to create an invoice
   - Ask for: customer name, amount, description, items
   - Response format: { "action": "CREATE_INVOICE", "data": { "customerName": "ABC Corp", "amount": 1500, "description": "Services", "items": [...] } }

2. **CREATE_EXPENSE**: When user wants to create an expense
   - Ask for: amount, category, description, date
   - Response format: { "action": "CREATE_EXPENSE", "data": { "amount": 500, "category": "Office", "description": "Supplies", "date": "2024-01-15" } }
   - **IMPORTANT**: Always use ISO date format (YYYY-MM-DD) in the JSON data, not DD.MM.YYYY

3. **SHOW_OVERDUE**: Show overdue invoices
   - Response format: { "action": "SHOW_OVERDUE" }

4. **VIEW_STATS**: Show business statistics
   - Response format: { "action": "VIEW_STATS" }

5. **QUERY_CUSTOMERS**: When user asks about customers
   - Response format: { "action": "QUERY_CUSTOMERS", "data": { "search": "name starts with A" } }

6. **CREATE_CUSTOMER**: When user wants to add a new customer
   - Ask for: name, email, address, city, zip
   - Response format: { "action": "CREATE_CUSTOMER", "data": { "name": "ABC Corp", "email": "info@abc.ch", "address": "Street 1", "city": "Zurich", "zip": "8001" } }

7. **CREATE_QUOTE**: When user wants to create a quote
   - Ask for: customer name, amount, description, items
   - Response format: { "action": "CREATE_QUOTE", "data": { "customerName": "ABC Corp", "amount": 2500, "description": "Consulting", "items": [...] } }

8. **IMPORT_PAYMENT**: When user provides payment information
   - Ask for: amount, reference, date, debtor name
   - Response format: { "action": "IMPORT_PAYMENT", "data": { "amount": 1500, "reference": "123456", "date": "2024-11-15", "debtorName": "ABC Corp" } }

**Examples:**

User: "Show me my overdue invoices"
Assistant: "You currently have ${context.overdueCount} overdue invoices. Let me show them to you.
\`\`\`json
{"action": "SHOW_OVERDUE"}
\`\`\`"

User: "Create an invoice for ABC Corp for CHF 1,500"
Assistant: "I'll create an invoice for ABC Corp for CHF 1,500 right away.

\`\`\`json
{"action": "CREATE_INVOICE", "data": {"customerName": "ABC Corp", "amount": 1500, "description": "Services"}}
\`\`\`"

User: "Add an expense of CHF 200 for office supplies"
Assistant: "I'll create an expense entry for CHF 200 for office supplies right now.

\`\`\`json
{"action": "CREATE_EXPENSE", "data": {"amount": 200, "category": "Office Supplies", "description": "Office supplies purchase"}}
\`\`\`"

**IMPORTANT**: Always include the JSON action block, but keep your message professional and concise. Don't show the JSON to the user - it's for internal use only.

Always be helpful, professional, and context-aware. Include the JSON action block only when you have enough information to perform the action.`
  }

  /**
   * Extract action from AI response (JSON format)
   */
  private static extractAction(message: string): any {
    try {
      // Look for JSON block in markdown code fence
      const jsonMatch = message.match(/```json\s*\n([\s\S]*?)\n```/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1])
      }
      
      // Try to find raw JSON object
      const rawJsonMatch = message.match(/\{[\s\S]*"action"[\s\S]*\}/)
      if (rawJsonMatch) {
        return JSON.parse(rawJsonMatch[0])
      }
      
      return undefined
    } catch (error) {
      console.error('Failed to parse action JSON:', error)
      return undefined
    }
  }

  /**
   * Query invoices with natural language
   */
  static async queryInvoices(companyId: string, query: string) {
    try {
      // Simple query parsing (can be enhanced with AI)
      let dbQuery = db.invoices()
        .select('*, customers(name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(10)

      // Check for common filters
      if (query.toLowerCase().includes('overdue')) {
        dbQuery = dbQuery.eq('status', 'OVERDUE')
      } else if (query.toLowerCase().includes('paid')) {
        dbQuery = dbQuery.eq('status', 'PAID')
      } else if (query.toLowerCase().includes('open')) {
        dbQuery = dbQuery.eq('status', 'OPEN')
      }

      const { data, error } = await dbQuery

      if (error) throw error

      return data
    } catch (error) {
      console.error('Query invoices error:', error)
      return []
    }
  }

  /**
   * Get business statistics
   */
  static async getStats(companyId: string) {
    try {
      // Get total revenue (paid invoices)
      const { data: paidInvoices } = await db.invoices()
        .select('total')
        .eq('company_id', companyId)
        .eq('status', 'PAID')

      const totalRevenue = paidInvoices?.reduce((sum, inv) => sum + inv.total, 0) || 0

      // Get outstanding amount (open + overdue)
      const { data: outstandingInvoices } = await db.invoices()
        .select('total')
        .eq('company_id', companyId)
        .in('status', ['OPEN', 'OVERDUE'])

      const totalOutstanding = outstandingInvoices?.reduce((sum, inv) => sum + inv.total, 0) || 0

      // Get counts
      const { count: totalInvoices } = await db.invoices()
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)

      const { count: totalCustomers } = await db.customers()
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)

      return {
        totalRevenue,
        totalOutstanding,
        totalInvoices: totalInvoices || 0,
        totalCustomers: totalCustomers || 0
      }
    } catch (error) {
      console.error('Get stats error:', error)
      return null
    }
  }
}

