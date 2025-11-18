import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from './src/constants/colors';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';


// Import Screens
import HomeScreen from './src/screens/HomeScreen';
import JobsScreen from './src/screens/JobsScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ExpertsScreen from './src/screens/ExpertsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import ResumeScreen from './src/screens/ResumeScreen';
import EducationExperienceScreen from './src/screens/EducationExperienceScreen';
import PrivacySecurityScreen from './src/screens/PrivacySecurityScreen';
import FollowRelationsScreen from './src/screens/FollowRelationsScreen';
import SavedPostsScreen from './src/screens/SavedPostsScreen';
import JobApplicationsScreen from './src/screens/JobApplicationsScreen';
import ScheduledConsultationsScreen from './src/screens/ScheduledConsultationsScreen';
import HelpCenterScreen from './src/screens/HelpCenterScreen';
import TermsScreen from './src/screens/TermsScreen';
import AboutScreen from './src/screens/AboutScreen';
import PostDetailScreen from './src/screens/PostDetailScreen';
import JobDetailScreen from './src/screens/JobDetailScreen';
import ExpertDetailScreen from './src/screens/ExpertDetailScreen';
import ChatScreen from './src/screens/ChatScreen';
import CreatePostScreen from './src/screens/CreatePostScreen';
import CreateJobScreen from './src/screens/CreateJobScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import ManageUsersScreen from './src/screens/ManageUsersScreen';
import PendingVerificationScreen from './src/screens/PendingVerificationScreen';
import WelcomeScreen from './src/screens/welcome';
import { subscribeToConversations } from './src/utils/chatService';
import { subscribeToUnseenNotifications } from './src/utils/notificationService';
import PortfolioScreen from './src/screens/PortfolioScreen';
import CreateProjectScreen from './src/screens/CreateProjectScreen';
import ProjectDetailScreen from './src/screens/ProjectDetailScreen';
import PortfolioBuilderScreen from './src/screens/PortfolioBuilderScreen';
import PortfolioPreviewScreen from './src/screens/PortfolioPreviewScreen';
import AvailabilityManagerScreen from './src/screens/AvailabilityManagerScreen';


const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Home Stack Navigator
function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="HomeFeed" 
        component={HomeScreen}
        options={{ title: 'AcademicConnect', headerShown: true }}
      />
      <Stack.Screen 
        name="PostDetail" 
        component={PostDetailScreen}
        options={{ title: 'Post Details' }}
      />
      <Stack.Screen 
        name="CreatePost" 
        component={CreatePostScreen}
        options={{ title: 'Create Post' }}
      />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ title: 'Member Profile' }}
      />
    </Stack.Navigator>
  );
}

// Jobs Stack Navigator
function JobsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="JobsList" 
        component={JobsScreen}
        options={{ title: 'Jobs & Opportunities' }}
      />
      <Stack.Screen 
        name="JobDetail" 
        component={JobDetailScreen}
        options={{ title: 'Job Details' }}
      />
      <Stack.Screen 
        name="CreateJob" 
        component={CreateJobScreen}
        options={{ title: 'Post a Job' }}
      />
    </Stack.Navigator>
  );
}

// Messages Stack Navigator
function MessagesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="MessagesList" 
        component={MessagesScreen}
        options={{ title: 'Messages' }}
      />
      <Stack.Screen
        name="CreateGroup"
        component={require('./src/screens/CreateGroupScreen').default}
        options={{ title: 'New Group' }}
      />
      <Stack.Screen
        name="GroupInfo"
        component={require('./src/screens/GroupInfoScreen').default}
        options={{ title: 'Group Info' }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen}
        options={({ route }) => ({ title: route.params?.name || 'Chat' })}
      />
    </Stack.Navigator>
  );
}

// Experts Stack Navigator
function ExpertsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="ExpertsList" 
        component={ExpertsScreen}
        options={{ title: 'Expert Consultation' }}
      />
      <Stack.Screen 
        name="ExpertDetail" 
        component={ExpertDetailScreen}
        options={{ title: 'Expert Profile' }}
      />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ProfileHome"
        component={ProfileScreen}
        options={{ title: 'Profile', headerShown: false }}
      />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ title: 'Member Profile' }}
      />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
      <Stack.Screen name="Resume" component={ResumeScreen} options={{ title: 'My CV / Resume' }} />
      <Stack.Screen name="EducationExperience" component={EducationExperienceScreen} options={{ title: 'Education & Experience' }} />
      <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} options={{ title: 'Privacy & Security' }} />
      <Stack.Screen name="FollowRelations" component={FollowRelationsScreen} options={{ title: 'Followers & Requests' }} />
      <Stack.Screen name="SavedPosts" component={SavedPostsScreen} options={{ title: 'Saved Posts' }} />
      <Stack.Screen name="JobApplications" component={JobApplicationsScreen} options={{ title: 'My Job Applications' }} />
      <Stack.Screen name="ScheduledConsultations" component={ScheduledConsultationsScreen} options={{ title: 'Scheduled Consultations' }} />
      <Stack.Screen name="HelpCenter" component={HelpCenterScreen} options={{ title: 'Help Center' }} />
      <Stack.Screen name="Terms" component={TermsScreen} options={{ title: 'Terms & Conditions' }} />
      <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About' }} />
      <Stack.Screen name="AvailabilityManager" component={AvailabilityManagerScreen} options={{ title: 'Availability Manager' }} />
    </Stack.Navigator>
  );
}

// Auth Stack Navigator
function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WelcomeScreen" component={WelcomeScreen} />
      <Stack.Screen name="LoginScreen" component={LoginScreen} />
      <Stack.Screen name="SignupScreen" component={SignupScreen} />
    </Stack.Navigator>
  );
}


// Admin Stack Navigator
function AdminStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="AdminDashboard" 
        component={AdminDashboardScreen}
        options={{ title: 'Admin Dashboard', headerShown: true }}
      />
      <Stack.Screen 
        name="AdminManageUsers" 
        component={ManageUsersScreen}
        options={{ title: 'Manage Users' }}
      />
    </Stack.Navigator>
  );
}

// Main Tab Navigator
function TabNavigator() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [unreadThreads, setUnreadThreads] = useState(0);
  const [unseenNotifs, setUnseenNotifs] = useState(0);
  const initialRoute = (() => {
    switch (user?.role) {
      case 'expert':
        return 'Experts';
      case 'teacher':
        return 'Home';
      case 'admin':
        return 'Profile';
      default:
        return 'Home';
    }
  })();
  
  useEffect(() => {
    if (!user?.uid) {
      setUnreadThreads(0);
      setUnseenNotifs(0);
      return;
    }
    const unsubConvs = subscribeToConversations(
      user.uid,
      (snapshot) => {
        try {
          const list = snapshot.docs.map((d) => d.data());
          const count = list.reduce((acc, c) => acc + ((c.unreadCounts?.[user.uid] || 0) > 0 ? 1 : 0), 0);
          setUnreadThreads(count);
        } catch (e) {
          setUnreadThreads(0);
        }
      },
      () => setUnreadThreads(0)
    );
    const unsubNotifs = subscribeToUnseenNotifications(
      user.uid,
      (count) => setUnseenNotifs(count),
      () => setUnseenNotifs(0)
    );
    return () => {
      try { unsubConvs && unsubConvs(); } catch (_) {}
      try { unsubNotifs && unsubNotifs(); } catch (_) {}
    };
  }, [user?.uid]);

  return (
    <Tab.Navigator
      initialRouteName={initialRoute}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Jobs') {
            iconName = focused ? 'briefcase' : 'briefcase-outline';
          } else if (route.name === 'Messages') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Notifications') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Experts') {
            iconName = focused ? 'school' : 'school-outline';
          } else if (route.name === 'Portfolio') {
            iconName = focused ? 'folder' : 'folder-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mediumGray,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
        },
        headerShown: false,
        tabBarBadge: route.name === 'Messages'
          ? (unreadThreads > 0 ? (unreadThreads > 99 ? '99+' : unreadThreads) : undefined)
          : route.name === 'Notifications'
          ? (unseenNotifs > 0 ? (unseenNotifs > 99 ? '99+' : unseenNotifs) : undefined)
          : undefined,
        tabBarBadgeStyle: {
          backgroundColor: colors.primary,
          color: '#fff',
          fontSize: 11,
          minWidth: 18,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Jobs" component={JobsStack} />
  <Tab.Screen name="Messages" component={MessagesStack} />
  <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Experts" component={ExpertsStack} />
      <Tab.Screen name="Portfolio" component={PortfolioStack} />
      {user?.role === 'admin' && (
        <Tab.Screen name="Admin" component={AdminStack} />
      )}
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

function PortfolioStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="PortfolioHome"
        component={PortfolioScreen}
        options={{ title: 'Portfolio' }}
      />
      <Stack.Screen
        name="PortfolioPreview"
        component={PortfolioPreviewScreen}
        options={{ title: 'Portfolio Preview' }}
      />
      <Stack.Screen
        name="PortfolioBuilder"
        component={PortfolioBuilderScreen}
        options={{ title: 'Code Portfolio' }}
      />
      <Stack.Screen
        name="CreateProject"
        component={CreateProjectScreen}
        options={{ title: 'New Project' }}
      />
      <Stack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{ title: 'Project' }}
      />
    </Stack.Navigator>
  );
}

// Decides between Auth flow and Main app based on auth state
// Simple Splash Screen component for bootstrapping phase
function SplashScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color={colors.primary} />
      {/* <Text> Welcome To This Page </Text> */}
    </View>
  );
}

function RootNavigator() {
  const { user, bootstrapped } = useAuth();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!bootstrapped ? (
        <Stack.Screen name="Splash" component={SplashScreen} />
      ) : !user ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : user.status && user.status !== 'approved' ? (
        <Stack.Screen name="Pending" component={PendingVerificationScreen} />
      ) : (
        <Stack.Screen name="Main" component={TabNavigator} />
      )}
    </Stack.Navigator>
  );
}

// Main App Component
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </SafeAreaView>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
