import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text, StyleSheet, Image } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { syncNow } from '../src/storage';

SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppReady(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    void syncNow();
  }, []);

  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync().catch(e => console.warn('Erro ao esconder splash screen:', e));
    }
  }, [appReady]);


  if (!appReady) {
    return (
      <View style={splashStyles.container}>
        <Image
          source={require('../assets/market4u.png')}
          style={splashStyles.logo}
          resizeMode="contain"
        />
        <Text style={splashStyles.title}>Controle de Validades</Text>
        <Text style={splashStyles.subtitle}>Gerenciamento de Vencimentos</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <TabsWithSafeArea />
    </SafeAreaProvider>
  );
}

function TabsWithSafeArea() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'ios' ? 20 : Math.max(insets.bottom, 5);
  const tabBarHeight = Platform.OS === 'ios' ? 85 : 60 + insets.bottom;
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      {offline && (
        <View style={[offlineBannerStyles.container, { paddingTop: insets.top + 8 }]}>
          <Text style={offlineBannerStyles.text}>
            Problemas na conexão. As alterações serão realizadas offline e adicionadas
            posteriormente quando houver conexão na base.
          </Text>
        </View>
      )}
      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: '#7CB24B',
            height: Platform.OS === 'ios' ? 125 : 120,
          },
          headerTintColor: '#fff',
          headerTitle: '',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: Platform.OS === 'ios' ? 20 : 18,
          },
          headerLeft: () => (
            <Image
              source={require('../assets/market4u.png')}
              style={{ width: 140, height: 50, marginLeft: 8 }}
              resizeMode="contain"
            />
          ),
          tabBarActiveTintColor: '#ffffff',
          tabBarInactiveTintColor: '#353535',
          tabBarStyle: {
            paddingBottom: bottomPadding,
            height: tabBarHeight,
            backgroundColor: '#7CB24B',
          },
          tabBarLabelStyle: {
            fontSize: 11,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Produtos',
            tabBarLabel: 'Produtos',
            tabBarIcon: () => null,
            headerRight: () => (
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginRight: 20 }}>
                Produtos
              </Text>
            ),
          }}
        />
        <Tabs.Screen
          name="locais"
          options={{
            title: 'Locais',
            tabBarLabel: 'Locais',
            tabBarIcon: () => null,
            headerRight: () => (
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginRight: 20 }}>
                Locais
              </Text>
            ),
          }}
        />
        <Tabs.Screen
          name="cadastro-produto"
          options={{
            title: 'Novo Produto',
            tabBarLabel: 'Cadastrar',
            tabBarIcon: () => null,
            headerRight: () => (
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginRight: 20 }}>
                Novo Produto
              </Text>
            ),
          }}
        />
        <Tabs.Screen
          name="importar"
          options={{
            title: 'Importar Excel',
            tabBarLabel: 'Importar',
            tabBarIcon: () => null,
            headerRight: () => (
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginRight: 20 }}>
                Importar Excel
              </Text>
            ),
          }}
        />
        <Tabs.Screen
          name="exportar"
          options={{
            title: 'Exportar',
            tabBarLabel: 'Exportar',
            tabBarIcon: () => null,
            headerRight: () => (
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginRight: 20 }}>
                Exportar
              </Text>
            ),
          }}
        />
        <Tabs.Screen
          name="configuracao"
          options={{
            title: 'Configuracao',
            tabBarLabel: 'Config',
            tabBarIcon: () => null,
            headerRight: () => (
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginRight: 20 }}>
                Configuracao
              </Text>
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#7CB24B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 14,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 24,
    color: '#e8f5e9',
    marginTop: 8,
  },
});

const offlineBannerStyles = StyleSheet.create({
  container: {
    backgroundColor: '#FF9800',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
});
