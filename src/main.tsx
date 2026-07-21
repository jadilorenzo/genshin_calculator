import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/react'
import App from './App.tsx'
import {
  LocalUserDataProvider,
  UserDataProvider,
} from './sync/UserDataProvider.tsx'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined

const appTree = (
  <BrowserRouter>
    {publishableKey ? (
      <UserDataProvider>
        <App />
      </UserDataProvider>
    ) : (
      <LocalUserDataProvider>
        <App />
      </LocalUserDataProvider>
    )}
  </BrowserRouter>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {publishableKey ? (
      <ClerkProvider
        publishableKey={publishableKey}
        afterSignOutUrl="/rotations"
      >
        {appTree}
      </ClerkProvider>
    ) : (
      appTree
    )}
  </StrictMode>,
)
