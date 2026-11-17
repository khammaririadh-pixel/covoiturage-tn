import { registerRootComponent } from 'expo';
import { Alert, Platform } from 'react-native';
import App from './App';

// Alert.alert does nothing on the web, so show the browser's own dialog there.
if (Platform.OS === 'web') {
  Alert.alert = (title, message) => window.alert(message ? `${title}\n\n${message}` : title);
}

registerRootComponent(App);
