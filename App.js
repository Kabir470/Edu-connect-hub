import React from 'react';
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
    </Stack.Navigator>
  );
}

// Auth Stack Navigator
function AuthNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="LoginScreen" 
        component={LoginScreen}
        options={{ title: 'Log In' }}
      />
      <Stack.Screen 
        name="SignupScreen" 
        component={SignupScreen}
        options={{ title: 'Sign Up' }}
      />

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
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Jobs" component={JobsStack} />
  <Tab.Screen name="Messages" component={MessagesStack} />
  <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Experts" component={ExpertsStack} />
      {user?.role === 'admin' && (
        <Tab.Screen name="Admin" component={AdminStack} />
      )}
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

// Decides between Auth flow and Main app based on auth state
// Simple Splash Screen component for bootstrapping phase
function SplashScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color={colors.primary} />
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
