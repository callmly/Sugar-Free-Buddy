# 🍬 No Sugar Challenge

  A collaborative web application for two people to track their sugar-free journey together with AI coaching in Lithuanian.

  ## Features

  ### 🎯 Core Functionality
  - **User Authentication**: Secure login with username and PIN code, with "Remember me" option
  - **Streak Tracking**: Real-time display of days and hours since last relapse
  - **Real-time Chat**: Chat between two users with persistent message history
  - **AI Coach**: OpenAI-powered coach that provides personalized responses in Lithuanian
  - **Daily Check-ins**: Track mood, craving levels, triggers, and notes
  - **Admin Panel**: Configure OpenAI settings, custom instructions, and manage relapse time

  ### 📊 Check-in System
  Daily check-in form includes:
  - **Mood**: 1-5 scale slider
  - **Craving**: 1-5 scale slider
  - **Trigger**: Dropdown with options (vakaras, po pietų, stresas, filmai, kavinės, kita)
  - **Note**: Optional text field for additional comments

  ### 🤖 AI Coach Features
  - Responds automatically after each check-in
  - Provides 3-6 sentences in Lithuanian
  - Offers concrete actions and gentle humor
  - Personalized based on mood, craving, and trigger data
  - References streak numbers in responses
  - Customizable via admin panel instructions

  ### ⚙️ Admin Panel
  Accessible at `/admin`:
  - Configure OpenAI API key
  - Select OpenAI model (GPT-4o, GPT-4o Mini, etc.)
  - Customize coach instructions
  - Set relapse time for streak calculation

  ## Tech Stack

  ### Frontend
  - React with TypeScript
  - Tailwind CSS + Shadcn UI components
  - Wouter for routing
  - WebSocket for real-time updates

  ### Backend
  - Express.js
  - PostgreSQL database
  - OpenAI API integration
  - WebSocket server
  - Session-based authentication with bcrypt

  ## Getting Started

  ### Prerequisites
  - Node.js installed
  - PostgreSQL database (automatically configured on Replit)
  - OpenAI API key (configure in admin panel after setup)

  ### Installation

  1. Install dependencies (if not already installed):
  ```bash
  npm install
  ```

  2. The database will be automatically initialized on first run

  3. Start the development server:
  ```bash
  npm run dev
  ```

  4. Visit the application at `http://localhost:5000`

  ### First Time Setup

  1. **Create Account**: Register with a username and PIN code
  2. **Access Admin Panel**: Navigate to `/admin`
  3. **Configure OpenAI**:
     - Add your OpenAI API key
     - Select desired model (default: gpt-4o-mini)
     - (Optional) Customize coach instructions
     - Set the relapse time to start tracking your streak

  4. **Start Using**: Return to dashboard and begin your journey!

  ## Usage

  ### Daily Routine
  1. **Check Your Streak**: View your progress on the dashboard
  2. **Daily Check-in**: Click "Patikrinimas" to submit your daily check-in
  3. **Get Coach Feedback**: AI coach responds with personalized advice
  4. **Chat**: Communicate with your accountability partner
  5. **Stay Motivated**: Watch your streak grow day by day!

  ### Chat Features
  - Send messages to your partner
  - AI coach participates in conversations
  - Real-time updates via WebSocket
  - Message history is persistent

  ### Admin Settings
  - **API Key**: Stored securely in database, never exposed to client
  - **Model Selection**: Choose between GPT-4o, GPT-4o Mini, GPT-4 Turbo, or GPT-3.5 Turbo
  - **Custom Instructions**: Tailor the coach's personality and response style
  - **Relapse Time**: Update to recalculate streak from a new starting point

  ## Database Schema

  ### Tables
  - `users`: User accounts with hashed passwords
  - `messages`: Chat messages and coach responses
  - `check_ins`: Daily check-in records
  - `admin_settings`: Application configuration

  ## Security

  - Passwords are hashed using bcrypt
  - Sessions are HTTP-only cookies
  - API keys stored securely in database
  - Environment variables for sensitive config

  ## Lithuanian Language

  The application is designed for Lithuanian speakers:
  - All UI text in Lithuanian
  - AI coach responds in Lithuanian
  - Trigger options in Lithuanian
  - Custom instructions can be in Lithuanian

  ## Support

  For issues or questions, please refer to the code comments or create an issue in the repository.

  ## License

  Built with ❤️ for accountability and health
  