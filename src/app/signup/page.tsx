// Redirect /signup → /register to support both URL patterns
import { redirect } from 'next/navigation'

export default function SignupPage() {
  redirect('/register')
}
