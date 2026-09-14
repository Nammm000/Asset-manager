package tech.getarrays.assetmanager.services.auth.refreshToken;

import tech.getarrays.assetmanager.models.User;
import tech.getarrays.assetmanager.services.auth.TokenPair;

public interface RefreshTokenService {

    String createToken(User user);

    TokenPair rotate(String rawToken);

    void revoke(String rawToken);

    void deleteAllByUserId(Long userId);
}
