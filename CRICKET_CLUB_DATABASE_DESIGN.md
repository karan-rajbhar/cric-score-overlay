# 🏏 Cricket Club Management App - Database Design

## Overview

This database design is specifically tailored for the Cricket Club Management App requirements, focusing on:
- **All users are players** by default
- **Club-level and match-level roles**
- **Comprehensive tournament management**
- **Match statistics claiming system**
- **Real-time scoring and live updates**
- **Community-driven cricket culture**

## 🎯 Core Design Principles

### 1. **Player-Centric Architecture**
- Every user is a player first
- Roles are contextual (club-level, match-level)
- Complete cricket journey tracking

### 2. **Flexible Role System**
- **Club Owners**: Players who created clubs
- **Club Admins**: Players assigned admin rights
- **Match Organizers**: Players managing specific matches
- **Members**: Regular players in clubs

### 3. **Cricket-Specific Features**
- Multiple cricket formats (T20, ODI, Custom overs)
- Comprehensive scoring system
- Statistics claiming and verification
- Real-time match updates

### 4. **Community Focus**
- Club discovery and joining
- Invitation systems
- Social features and achievements
- Match history and career tracking

## 📊 Database Schema Summary

### **Core Tables:**

1. **`users`** - All users are players with cricket preferences
2. **`clubs`** - Cricket clubs with public/private settings
3. **`club_memberships`** - Player roles within clubs (owner/admin/member)
4. **`club_invitations`** - Email/phone/user invitation system
5. **`teams`** - Club-level and match-level teams with templates
6. **`team_players`** - Squad management with playing XI selection
7. **`tournaments`** - Multiple formats with registration system
8. **`tournament_registrations`** - Team registration with payment tracking
9. **`tournament_standings`** - Live standings with Net Run Rate
10. **`matches`** - Comprehensive match management with custom formats
11. **`innings`** - Innings-level data with extras breakdown
12. **`batting_performances`** - Individual batting statistics
13. **`bowling_performances`** - Individual bowling statistics  
14. **`ball_by_ball`** - Live ball-by-ball scoring
15. **`partnerships`** - Partnership tracking
16. **`fall_of_wickets`** - Wicket progression
17. **`match_claims`** - Retroactive statistics claiming with verification
18. **`player_career_stats`** - Aggregated career statistics
19. **`match_events`** - Real-time match events
20. **`notifications`** - In-app notifications system
21. **`user_achievements`** - Cricket milestones and achievements

## 🔑 Key Features Addressed

### ✅ **User Management**
- All users are players by default
- Cricket-specific profile information (batting/bowling style, preferred position)
- Flexible contact options (email or phone)

### ✅ **Club System**
- Any user can create clubs
- Public/private club discovery
- Role-based permissions (owner, admin, member)
- Invitation system via email/phone/existing users
- Club categorization (community, corporate, school, professional)

### ✅ **Team Management**
- Club-level and match-level teams
- Team templates for reusable compositions
- Playing XI selection with batting order
- Captain and vice-captain assignment
- Jersey number management

### ✅ **Tournament Management**
- Multiple tournament formats (League, Knockout, Mixed, Round Robin)
- Team registration with payment tracking
- Live standings with Net Run Rate calculation
- Custom overs support (5, 10, 15+ overs)
- Entry fees and prize pool management

### ✅ **Match System**
- Direct match creation without tournaments
- Multiple cricket formats (T20, ODI, Custom)
- Match-level admin assignment
- Live scoring state tracking
- Comprehensive result recording

### ✅ **Cricket-Specific Scoring**
- Complete scorecard with batting, bowling, fielding statistics
- Live commentary and ball-by-ball updates
- Comprehensive extras tracking (byes, leg-byes, wides, no-balls)
- Partnership and fall of wickets tracking
- Real-time match state management

### ✅ **Statistics & Analytics**
- Complete career statistics tracking
- Batting/bowling averages and strike rates
- Milestone tracking (centuries, five-wickets)
- Fielding statistics
- Performance comparison tools

### ✅ **Match Statistics Claiming**
- Retroactive statistics claiming system
- Peer verification process
- Integration with career statistics
- Historical cricket journey tracking

### ✅ **Real-time & Communication**
- Real-time match events and notifications
- Achievement tracking and milestones
- In-app messaging capabilities
- Match reminders and updates
- Social features integration

## 🔐 Security Implementation

### **Row Level Security (RLS)**
- **Public Access**: Match data and player stats publicly readable
- **Club Permissions**: Role-based access (owner/admin/member)
- **Match Permissions**: Creator and admin-based scoring rights
- **User Privacy**: Own data management and notifications

### **Permission Levels**
1. **Public**: Match viewing, player stats, club discovery
2. **Club Member**: Club data access, team participation
3. **Club Admin**: Team management, match creation
4. **Club Owner**: Full club control, admin assignment
5. **Match Admin**: Live scoring, match management

## 🚀 Implementation Highlights

### **Flexible Architecture**
- Supports both tournament and direct matches
- Club-optional structure (independent matches allowed)
- Template-based team management
- Contextual role assignments

### **Cricket-Specific Design**
- All major cricket formats supported
- Comprehensive extras and dismissal types
- Partnership and wicket progression tracking
- Real-time scoring with commentary

### **Community Features**
- Discovery and invitation systems
- Achievement and milestone tracking
- Career statistics with claiming system
- Social interaction capabilities

### **Mobile-Optimized**
- Touch-friendly scoring interface design
- Offline capability considerations
- Real-time synchronization
- Push notification support

## 📈 Scalability Considerations

### **Performance**
- Strategic indexing for fast queries
- Efficient relationship design
- Real-time optimization
- Mobile-first approach

### **Growth Support**
- Multi-club architecture
- Tournament scaling
- Statistics aggregation
- Historical data management

This database design provides a comprehensive foundation for the Cricket Club Management App, addressing all specified requirements while maintaining flexibility for future enhancements and community growth. 