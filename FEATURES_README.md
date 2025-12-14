# Project: AcademicConnect (EdeX)

## High-Level Summary

AcademicConnect (also referred to as EdeX) is a comprehensive professional networking and collaboration platform designed for the academic and expert community. Built with React Native and powered by a Firebase backend, it connects students, educators, and industry experts in a single ecosystem. The application facilitates knowledge sharing, career opportunities, and portfolio development, with a strong emphasis on user verification and role-based content.

---

## Core Features

### 1. User Management & Authentication
- **Secure Sign-up/Login:** Standard email/password authentication using Firebase Auth.
- **Admin Verification System:** New users sign up into a "pending" state. An administrator must verify their credentials (e.g., NID information) to grant full access to the platform, ensuring a trusted user base.
- **Role-Based Access Control:** User capabilities are determined by their role (e.g., Student, Teacher, Expert). For example, only users with the 'Expert' or 'Teacher' role can post job opportunities.

### 2. Rich & Customizable User Profiles
- **Detailed Profiles:** Users can create detailed profiles showcasing their education, experience, and skills.
- **Role Specialization:** Users select a primary role and can further specify their expertise with various sub-roles (e.g., "Software Engineer," "Mathematician," "Graphics Designer").
- **Portfolio Builder:** An integrated tool for users to build and showcase a personal portfolio. This includes adding projects, descriptions, and links.
- **"Code Site" Feature:** A unique portfolio feature that allows users to create a mini-website using custom HTML, CSS, and JavaScript to demonstrate their coding skills directly within the app.

### 3. Content & Knowledge Sharing
- **Post Creation:** Users can create and share posts with the community, similar to a social feed.
- **Job Board:** A dedicated section for posting and discovering job opportunities. (Note: Currently in development, using placeholder data).

### 4. Social & Professional Networking
- **User Following:** Users can follow each other to stay updated on their activities and posts.
- **Direct Messaging:** A real-time chat feature for one-on-one conversations.
- **Group Collaboration:** Functionality for creating and managing groups (details to be expanded).

### 5. Administration & Moderation
- **Admin Dashboard:** A central dashboard for administrators to manage the platform.
- **User Verification Queue:** Admins can review and approve or deny pending user registrations.
- **Content Moderation:** Server-side functions are in place to support content filtering and moderation.

---

## Technical Stack

- **Frontend:** React Native
- **Backend & Database:** Google Firebase (Firestore, Firebase Authentication, Firebase Storage)
- **Serverless Functions:** Firebase Functions (Node.js) for backend logic like user management and content moderation.
