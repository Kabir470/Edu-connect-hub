import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Image, Dimensions } from 'react-native';
import colors from '../constants/colors';
import Logo from '../../assets/logo.png';

// Background icons
import Book from '../../assets/bg/book.png';
import Cap from '../../assets/bg/cap.png';
import Pencil from '../../assets/bg/pencil.png';
import Globe from '../../assets/bg/globe.png';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }) {

  // ====== MAIN ELEMENT ANIMATIONS ======
  const logoScale = useRef(new Animated.Value(1)).current;   // Infinite breathing
  const logoFade = useRef(new Animated.Value(0)).current;

  const titleFade = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(20)).current;

  const subtitleFade = useRef(new Animated.Value(0)).current;

  const buttonFade = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0.8)).current;

  // ====== MULTIPLE FLOATING ICONS ======
  const floats = Array.from({ length: 8 }).map(() => ({
    translateY: new Animated.Value(0),
    fade: new Animated.Value(0.10)
  }));

  useEffect(() => {

    // ====== LOGO INFINITE BREATHING ======
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, { toValue: 1.06, duration: 2200, useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 2200, useNativeDriver: true }),
      ])
    ).start();

    // ====== INTRO SEQUENCE ======
    Animated.sequence([
      Animated.timing(logoFade, { toValue: 1, duration: 600, useNativeDriver: true }),

      Animated.parallel([
        Animated.timing(titleFade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(titleSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),

      Animated.timing(subtitleFade, { toValue: 1, duration: 500, useNativeDriver: true }),

      Animated.parallel([
        Animated.timing(buttonFade, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(buttonScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      ]),
    ]).start();

    // ====== FLOATING & FADING ICONS ======
    floats.forEach(({ translateY, fade }, index) => {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(translateY, { toValue: -15, duration: 3000 + index * 200, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 15, duration: 3000 + index * 200, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(fade, { toValue: 0.05, duration: 2000, useNativeDriver: true }),
            Animated.timing(fade, { toValue: 0.15, duration: 2000, useNativeDriver: true }),
          ]),
        ])
      ).start();
    });

  }, []);

  const bgIcons = [
    { src: Cap, size: 55, style: { top: height * 0.30, right: 40 } },
    { src: Book, size: 40, style: { top: height * 0.50, left: 80 } },
    { src: Globe, size: 35, style: { top: 200, left: width * 0.35 } },
    // { src: Pencil, size: 45, style: { bottom: 160, left: width * 0.25 } },
  ];

  return (
    <View style={styles.container}>

      {/* ====== FLOATING ICONS ====== */}
      {bgIcons.map((icon, i) => (
        <Animated.Image
          key={i}
          source={icon.src}
          style={[
            styles.bgIcon,
            icon.style,
            {
              width: icon.size,
              height: icon.size,
              opacity: floats[i].fade,
              transform: [{ translateY: floats[i].translateY }],
            }
          ]}
        />
      ))}

      {/* ====== CIRCLE + LOGO TOGETHER ====== */}
      <Animated.View 
        style={[
          styles.logoCircle,
          { opacity: logoFade, transform: [{ scale: logoScale }] }
        ]}
      >
        <Image source={Logo} style={styles.logo} resizeMode="contain" />
      </Animated.View>

      {/* ====== TITLE ====== */}
      <Animated.Text style={[styles.title, { opacity: titleFade, transform: [{ translateY: titleSlide }] }]}>
        Welcome to EdeX
      </Animated.Text>

      {/* ====== SUBTITLE ====== */}
      <Animated.Text style={[styles.subtitle, { opacity: subtitleFade }]}>
        Your learning, career & network hub 🎓
      </Animated.Text>

      {/* ====== BUTTON ====== */}
      <Animated.View style={{ opacity: buttonFade, transform: [{ scale: buttonScale }], marginTop: 40 }}>
        <TouchableOpacity style={styles.button} onPress={() => navigation.replace('LoginScreen')}>
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </Animated.View>

    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  /* ===== LOGO CIRCLE WITH GLOW ===== */
  logoCircle: {
    width: width * 0.55,
    height: width * 0.55,
    borderRadius: width,
    backgroundColor: "#ffffffdd",
    justifyContent: 'center',
    alignItems: 'center',

    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 10 },

    elevation: 8,
    marginBottom: 20,
  },

  bgIcon: {
    position: 'absolute',
    opacity: 0.10,
  },

  logo: {
    width: "50%",
    height: "50%",
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 10,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 16,
    color: colors.mediumGray,
    textAlign: 'center',
    marginTop: 8,
  },

  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 60,
    borderRadius: 25,
    elevation: 4,
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
