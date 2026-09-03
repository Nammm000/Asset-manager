package tech.getarrays.assetmanager.services.auth;

import tech.getarrays.assetmanager.models.User;

public interface RefreshTokenService {

    String createToken(User user);

    TokenPair rotate(String rawToken);

    void revoke(String rawToken);

    void deleteAllByUserId(Long userId);
}
