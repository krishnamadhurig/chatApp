# Real-Time Chat Application

A full-stack chat app with private and group conversations, live messaging, typing indicators, read receipts, online presence, and file/image sharing stored in AWS S3.

## Features

- **Authentication:** signup, login, protected routes, JWT sessions, bcrypt-hashed passwords
- **Private chat:** one conversation per pair of users (duplicates are prevented by a unique key)
- **Group chat:** name and picture, add/remove members, leave group, ownership transfer, delete group
- **Real time (Socket.IO):** instant messages, typing indicators, online/offline presence
- **Message status:** Sent, Delivered and Read for private chats; "Read by N / Read by all" in groups
- **Unread counts** per conversation, updated live
- **Media:** images and files up to 10 MB, stored in a private S3 bucket and served with short-lived signed URLs
- **Profile:** change name and photo
- **Search** for people by name or email, with pagination for message history

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React, Vite, React Router, plain CSS, Axios, Socket.IO client |
| Backend | Node.js, Express, Socket.IO, JWT, bcryptjs |
| Database | MySQL with Sequelize ORM (tables created by `sequelize.sync()`) |
| Storage | AWS S3 (private bucket, presigned URLs) |
| Security | helmet, cors, express-rate-limit, express-validator |

## Architecture

```
React component -> ChatContext -> socket.js ---(Socket.IO)---> socket/chatHandler.js
                               -> chatService.js --(REST)----> routes -> controllers -> services -> Sequelize models -> MySQL
                                                                                         \-> storageService -> AWS S3
```

- **Routes** declare the URL and the validation rules.
- **Controllers** read the request and send the response.
- **Services** hold the business rules (who may do what) and talk to the database or S3.
- **Socket.IO** handles live events. REST controllers can also push events through a small emitter module, so a group rename reaches everyone instantly.
- Every user joins a personal room (`user:<id>`), so events are sent to people, not to individual tabs.

## Project structure

```
ChatApp/
├── server/
│   ├── src/
│   │   ├── config/        database connection
│   │   ├── models/        User, Conversation, ConversationMember, Message, ReadMarker
│   │   ├── routes/        auth, users, conversations, messages
│   │   ├── controllers/
│   │   ├── services/      business logic and S3 storage
│   │   ├── middleware/    auth, validate, upload, errorHandler
│   │   ├── socket/        server setup, presence, chat events, emitter
│   │   ├── utils/         ApiError, asyncHandler, file rules
│   │   ├── app.js
│   │   └── server.js
│   └── .env.example
└── client/
    ├── src/
    │   ├── components/    Sidebar, ChatWindow, MessageList, MessageBubble, MessageInput, GroupInfo, NewGroupModal, Avatar
    │   ├── context/       AuthContext, ChatContext
    │   ├── hooks/         useUserSearch
    │   ├── pages/         Login, Signup, Chat, Profile
    │   ├── services/      REST calls
    │   └── socket/        shared Socket.IO connection
    └── .env.example
```

## Database schema

| Table | Main columns |
|---|---|
| **Users** | id, name, email (unique), password (hash), profileImage, isOnline, lastSeen |
| **Conversations** | id, type (`private`/`group`), name, groupImage, createdBy, privateKey (unique, `minId_maxId`) |
| **ConversationMembers** | conversationId, userId (unique together) |
| **Messages** | id, conversationId, senderId, message, messageType (`text`/`image`/`file`), mediaUrl, fileName, isRead, createdAt |
| **ReadMarkers** | conversationId, userId, lastReadMessageId (unique together), used for group read receipts |

Only the S3 location of a file is stored in MySQL, never the file itself.

## API

All routes except signup and login need the header `Authorization: Bearer <token>`. Responses use one shape: `{ "success": true, "data": ... }` or `{ "success": false, "error": "message" }`. All paths below start with `/api`.

**Auth**

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/signup` | Create an account (rate limited) |
| POST | `/auth/login` | Log in (rate limited) |
| GET | `/auth/me` | Current user |

**Users**

| Method | Path | Purpose |
|---|---|---|
| GET | `/users?search=` | Search users by name or email |
| GET | `/users/:id` | One user's public profile |
| PUT | `/users/profile` | Update name and/or photo (multipart) |

**Conversations**

| Method | Path | Purpose |
|---|---|---|
| GET | `/conversations` | conversations with last message and unread count |
| POST | `/conversations` | Start a private chat (`{ userId }`) or create a group (`{ type: "group", name, memberIds }`) |
| GET | `/conversations/:id` | One conversation |
| PUT | `/conversations/:id` | Rename a group (creator only) |
| PUT | `/conversations/:id/image` | Set the group picture (creator only) |
| POST | `/conversations/:id/members` | Add members (creator only) |
| DELETE | `/conversations/:id/members/:userId` | Remove a member (creator only) |
| POST | `/conversations/:id/leave` | Leave a group |
| DELETE | `/conversations/:id` | Delete a group (creator only) |

**Messages**

| Method | Path | Purpose |
|---|---|---|
| GET | `/conversations/:conversationId/messages?page=&limit=` | Paginated history |
| POST | `/conversations/:conversationId/messages` | Send a text message |
| POST | `/conversations/:conversationId/media` | Upload an image or file (multipart) |
| PUT | `/messages/:id/read` | Mark one message as read |
| PUT | `/conversations/:conversationId/read` | Mark a whole conversation as read |
| DELETE | `/messages/:id` | Delete own message |

## Socket.IO events

The client connects with its JWT in the handshake. Connections without a valid token are rejected.

| Direction | Event | Meaning |
|---|---|---|
| client → server | `send_message` | Send a text message (acknowledged with the saved message) |
| client → server | `message_read` | The open conversation was read |
| client → server | `typing_start` / `typing_stop` | Typing indicator |
| client → server | `delete_message` | Delete message |
| server → client | `new_message` | A message arrived |
| server → client | `messages_read` | Someone read a conversation |
| server → client | `typing_start` / `typing_stop` | Someone is typing |
| server → client | `message_deleted` | A message was deleted |
| server → client | `online_users`, `user_online`, `user_offline` | Presence |
| server → client | `conversation_updated` / `conversation_removed` | Group changed, or you were removed |
| server → client | `user_updated` | A contact changed their name or photo |

## AWS S3 setup

1. Create a bucket with **Block all public access** turned on. Files are served only through signed URLs.
2. Create an IAM user for the app with a policy that allows only `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on `arn:aws:s3:::YOUR_BUCKET/*`.
3. Create an access key for that user and put it in `server/.env`.
4. Set `AWS_REGION` and `AWS_S3_BUCKET` to match the bucket.

Never commit `.env`, and never use root AWS account's keys.

## Environment variables

**`server/.env`**

```
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=chatapp
DB_USER=root
DB_PASSWORD=mysql_password
JWT_SECRET=long_random_string
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
AWS_ACCESS_KEY_ID=key
AWS_SECRET_ACCESS_KEY=secret
AWS_REGION=ap-south-1
AWS_S3_BUCKET=bucket-name
```

**`client/.env`**

```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

## Getting started

Requirements: Node.js 18+, MySQL 8, an AWS account (only needed for file and photo uploads).

```bash
# 1. Create the database
mysql -u root -p -e "CREATE DATABASE chatapp;"

# 2. Server
cd server
cp .env.example .env      
npm install
npm run dev               # http://localhost:5000, tables are created on first start

# 3. Client (open a new terminal)
cd client
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

## Security

- Passwords are hashed with bcrypt and are never returned by the API
- JWT is checked on every protected route and on every socket connection
- Authorization is enforced in the service layer: we can only read, send to or change conversations belong to, and group admin actions are creator-only
- helmet security headers, CORS limited to the client origin, rate limiting on signup and login
- Request validation with express-validator, and a central error handler that never leaks stack traces
- Uploads are checked by extension, MIME type, file signature (magic bytes) and size, and stored under random names
- The S3 bucket is private, links expire after one hour, and the IAM user has the minimum permissions

## Known limitations

- Tables are created with `sequelize.sync()`. This is simple, but it does not change existing tables. A production app should use migrations.
- The token is kept in `localStorage`, which is easy to use but exposed to XSS. Cookies with `httpOnly` are the stricter alternative.
- The app runs as a single server. Running several instances would need the Socket.IO Redis adapter.
- Signed image links last one hour, so a tab left open longer shows initials until it refreshes.
