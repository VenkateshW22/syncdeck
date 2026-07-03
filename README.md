<img width="140" height="143" alt="Screenshot 2026-06-19 at 3 41 26 PM" src="https://github.com/user-attachments/assets/179e0228-8c88-4acd-96e6-4e181be87559" />

# SYNCDECK Application Overview

SyncDeck is a real-time virtual classroom and collaborative session management platform designed to facilitate interactive teaching, webinars, workshops, and training sessions. Built using a full-stack architecture comprising React, Express.js, WebSockets, Redis, and PostgreSQL, the platform enables synchronized collaboration, resource distribution, participant engagement, and intelligent classroom analytics.

## Host Module

The Host Dashboard functions as the central control interface for managing live sessions.

### Session Management

* Create and manage live classrooms
* Admit or remove participants
* Assign participant roles and permissions
* Monitor participant activity in real time

### Interactive Whiteboard

* Multi-user collaborative drawing
* Real-time synchronization of annotations
* Shared visual workspace for explanations and discussions

### Presentation & Screen Sharing

* Live presentation broadcasting
* Screen sharing through WebRTC
* Synchronized presentation state across participants

### Chat & Reactions

* Real-time messaging
* Emoji reactions
* Question handling through raise-hand functionality

### Polls & Quizzes

* Dynamic poll creation
* Multiple-choice questionnaires
* Live response visualization
* Instant result analytics

### Resource Management

* Share documents and learning materials
* Publish code snippets
* Distribute reference links
* Broadcast announcements

### Classroom Analytics

* Live participant statistics
* Session activity timeline
* Poll participation metrics
* Engagement monitoring

### AI-Assisted Insights

* Session summaries
* Key discussion points
* Learning outcome extraction
* Classroom recommendations based on participant interactions

### Report Generation

Generate downloadable session reports containing:

* Attendance records
* Participant statistics
* Poll summaries
* Engagement metrics
* Audit logs

---

# Participant Module

The Participant Dashboard provides an interactive learning environment that enables active participation throughout the session.

### Live Classroom

* Join synchronized classroom sessions
* View live presentations
* Access collaborative whiteboard
* Receive real-time updates

### Interactive Learning

* Draw collaboratively on the whiteboard
* Participate in polls and quizzes
* Raise hand to request interaction
* React using emoji responses

### Resource Hub

* Access shared documents
* View code snippets
* Open reference links
* Download learning materials

### Session Continuity

* Automatic session recovery after refresh
* State synchronization after reconnection
* Restoration of chats, polls, and whiteboard state

---

# Core Platform Capabilities

### Real-Time Synchronization

* WebSocket-based bidirectional communication
* Live synchronization of classroom events
* Low-latency participant updates

### Persistent Session Recovery

* Redis-backed state hydration
* Automatic recovery after reconnection
* Database-backed persistence for critical session data

### Security & Access Control

* JWT-based authentication
* Role-based authorization
* Waiting room approval
* Controlled participant permissions

### Scalable Architecture

* React frontend
* Express.js backend
* PostgreSQL relational database
* Redis for caching and synchronization
* WebRTC for peer-to-peer media streaming

### Responsive User Experience

* Desktop and mobile support
* Adaptive layouts
* High-performance interface optimized for real-time collaboration
