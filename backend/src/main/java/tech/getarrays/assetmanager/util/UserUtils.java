package tech.getarrays.assetmanager.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;
import tech.getarrays.assetmanager.configuration.RequestSecurityContext;
import tech.getarrays.assetmanager.exception.NotFoundException;
import tech.getarrays.assetmanager.models.*;
import tech.getarrays.assetmanager.repo.UserRepo;

@Slf4j
@Component
public class UserUtils {

    static UserRepo userRepo;
    static RequestSecurityContext requestSecurityContext;

    @Autowired
    public UserUtils(UserRepo theUserRepo,
                            RequestSecurityContext theRequestSecurityContext) {
        userRepo = theUserRepo;
        requestSecurityContext = theRequestSecurityContext;
    }

    public static void checkOwnership(Asset asset) {
        if ("ROLE_ADMIN".equals(requestSecurityContext.getRole())) {
            return;
        }
        User user = getCurrentUser();
        if (!asset.getUser().getId().equals(user.getId())) {
            log.warn("User {} tried to access land asset {} owned by {}", user.getEmail(), asset.getId(), asset.getUser().getId());
            throw new AccessDeniedException("You don't have access to this asset");
        }
    }

    public static User getCurrentUser() {
        User user = userRepo.findFirstByEmail(requestSecurityContext.getUsername());
        if (user == null) {
            throw new NotFoundException("Authenticated user doesn't exist");
        }
        return user;
    }
}
