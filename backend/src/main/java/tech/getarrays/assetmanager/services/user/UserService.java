package tech.getarrays.assetmanager.services.user;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import tech.getarrays.assetmanager.models.User;
import tech.getarrays.assetmanager.repo.UserRepo;
import tech.getarrays.assetmanager.util.AssetUtils;
import tech.getarrays.assetmanager.wrapper.UserWrapper;

import tech.getarrays.assetmanager.exception.UserNotFoundException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
public class UserService {

    UserRepo userRepo;

    @Autowired
    public UserService(UserRepo theUserRepo) {
        userRepo = theUserRepo;
    }

    public ResponseEntity<List<UserWrapper>> getAllUsers() {
        try {
            return new ResponseEntity<>(userRepo.getAllUser(), HttpStatus.OK);
        } catch (Exception ex) {
            log.error("Error getting all users", ex);
            return new ResponseEntity<>(new ArrayList<>(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public ResponseEntity<String> updateUserStatus(Long id, Map<String, String> requestMap) {
        Optional<User> optional = userRepo.findById(id);
        if (optional.isPresent()) {
            userRepo.updateStatus(requestMap.get("status"), id);
            return AssetUtils.getResponseEntity("User status updated successfully", HttpStatus.OK);
        }
        log.error("updateUserStatus: User id {} doesn't exist", id);
        throw new UserNotFoundException("User id " + id + " doesn't exist");
    }

    public ResponseEntity<String> updateUserRole(Long id, Map<String, String> requestMap) {
        Optional<User> optional = userRepo.findById(id);
        if (optional.isPresent()) {
            String userROLE = requestMap.get("role");
            try {
                User.Role userRole = User.Role.valueOf(userROLE);
                userRepo.updateRole(userRole, id);
                return AssetUtils.getResponseEntity("User role updated successfully", HttpStatus.OK);
            } catch (IllegalArgumentException e) {
                log.error("updateUserRole: Invalid role value '{}'", userROLE);
                return AssetUtils.getResponseEntity("Invalid role. Must be ROLE_USER or ROLE_ADMIN", HttpStatus.BAD_REQUEST);
            }
        }
        log.error("updateUserRole: User id {} doesn't exist", id);
        throw new UserNotFoundException("User id " + id + " doesn't exist");
    }

    public ResponseEntity<String> deleteUser(Long id) {
        Optional<User> optional = userRepo.findById(id);
        if (optional.isPresent()) {
            userRepo.deleteById(id);
            return AssetUtils.getResponseEntity("User deleted successfully", HttpStatus.OK);
        }
        log.error("deleteUser: User id {} doesn't exist", id);
        throw new UserNotFoundException("User id " + id + " doesn't exist");
    }
}
