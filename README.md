**AI Assistant!**

A small Node.js chatbot that collects three pieces of information from the user: Name → Time → Age.

How It Works

The chatbot guides the user through three simple steps:

Name — The chatbot first asks for the user's name and continues only when a valid name is provided.
Time — It then asks how much time the user needs, such as 3 minutes, 5 min, or 1 hour.
Wait — Once a valid duration is provided, the chatbot starts the waiting period. If the user sends another message before the time is up, the chatbot asks them to wait and shows the remaining time.
Age — After the waiting period ends, the chatbot asks for the user's age. The conversation is completed once a valid age between 1 and 120 is provided.

**Setup**

First, create a .env file from the example:

Then add your OpenAI API key to the .env file. You can also optionally configure the OpenAI-compatible base URL and model.

Install the dependencies:
npm install

Start the application:
npm start

The chatbot will be available at:
http://localhost:3000


**Environment Variables**

Variable	    	Description
OPENAI_API_KEY  	Used for extracting the user's name from their message.
PORT                Sets the server port. The default is 3000.


**If an OpenAI API key is not provided, the chatbot can still run. In that case, it uses a regular-expression-based fallback for name extraction.**

**API Endpoints**

The chatbot provides two API endpoints:

GET /api/state — Returns the current conversation step and prompt. This is used when the page is loaded or refreshed.
POST /api/chat — Accepts a user message in the form { "message": "..." } and returns the chatbot's response, current step, remaining wait time (when applicable), and completion status.
POST /api/new-chat — Starts a new conversation with a fresh session.


**Project Structure**

server.js              Express entry point
src/sessionStore.js    In-memory session storage
src/conversation.js    Conversation step logic
src/timeParse.js       Duration and age parsing
src/llm.js             Single-turn name extraction
public/                Chatbot user interface

**Sessions**

The chatbot uses in-memory sessions. The server keeps only the information needed to continue the current conversation, such as the current step, name, duration, waiting time, and age.

Chat messages themselves are not stored.

Because the sessions are stored in memory, restarting the server will clear the existing sessions and start fresh conversations.