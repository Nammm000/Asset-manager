package tech.getarrays.assetmanager.services.auth;

import tech.getarrays.assetmanager.dto.Auth.SignupDTO;
import tech.getarrays.assetmanager.dto.UserDTO;

public interface AuthService {
    UserDTO createUser(SignupDTO signupDTO);
}
