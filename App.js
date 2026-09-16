// App.js
// The root component of the entire application. Sets up navigation
// and defines the screen structure.
//
// NAVIGATION ARCHITECTURE:
// The app uses two layers of navigation:
//
// 1. STACK NAVIGATOR (outer layer):
//    SearchScreen -> Dashboard
//    When the user taps a search result, the Dashboard screen "pushes"
//    on top of SearchScreen. The user can press the back arrow to return
//    to search. This is like navigating between pages on a website.
//
// 2. BOTTOM TAB NAVIGATOR (inner layer, the "Dashboard"):
//    Overview | Financials | Ratios | DCF
//    Once on the dashboard, the bottom of the screen shows 4 tabs.
//    Tapping between them switches the content without leaving the
//    dashboard. This is like tabs within a single page.
//
// The Stack wraps the Tabs. SearchScreen is one stack screen.
// DashboardTabs (which contains the 4 tab screens) is the other.
//
// PASSING DATA:
// When SearchScreen navigates to Dashboard, it passes { ticker: 'AAPL' }
// as a route parameter. The DashboardTabs component receives this and
// passes it to each tab screen via initialParams. This way, every tab
// screen can read route.params.ticker to know which company to load.

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import SearchScreen from './src/screens/SearchScreen';
import OverviewScreen from './src/screens/OverviewScreen';
import FinancialsScreen from './src/screens/FinancialsScreen';
import RatiosScreen from './src/screens/RatiosScreen';
import DCFScreen from './src/screens/DCFScreen';
import colors from './src/constants/colors';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// The bottom tab navigator that serves as the "Dashboard."
// Each tab receives the ticker from the route params.
const DashboardTabs = ({ route }) => {
  const { ticker } = route.params;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: 6,
          paddingTop: 6,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Overview"
        component={OverviewScreen}
        initialParams={{ ticker }}
        options={{ tabBarLabel: 'Overview' }}
      />
      <Tab.Screen
        name="Financials"
        component={FinancialsScreen}
        initialParams={{ ticker }}
        options={{ tabBarLabel: 'Financials' }}
      />
      <Tab.Screen
        name="Ratios"
        component={RatiosScreen}
        initialParams={{ ticker }}
        options={{ tabBarLabel: 'Ratios' }}
      />
      <Tab.Screen
        name="DCF"
        component={DCFScreen}
        initialParams={{ ticker }}
        options={{ tabBarLabel: 'DCF' }}
      />
    </Tab.Navigator>
  );
};

// The root stack navigator.
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen
          name="Search"
          component={SearchScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Dashboard"
          component={DashboardTabs}
          options={({ route }) => ({
            title: route.params?.ticker || 'Dashboard',
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
