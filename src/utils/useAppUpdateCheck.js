import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { Alert } from 'react-native';

const useAppUpdateCheck = () => {
  useEffect(() => {
    const check_for_update = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          Alert.alert(
            'Update Available',
            'A new version of the app is available. Please update to continue.',
            [
              {
                text: 'Update Now',
                onPress: async () => {
                  await Updates.reloadAsync();
                },
              },
            ]
          );
        }
      } catch (e) {
        console.log(e);
      }
    };
    check_for_update();
  }, []);
};

export default useAppUpdateCheck;
