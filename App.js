import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from './src/constants/colors';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';


// Import Screens
import HomeScreen from './src/screens/HomeScreen';
import JobsScreen from './src/screens/JobsScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ExpertsScreen from './src/screens/ExpertsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
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
      <Tab.Screen name="Experts" component={ExpertsStack} />
      {user?.role === 'admin' && (
        <Tab.Screen name="Admin" component={AdminStack} />
      )}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
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
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
