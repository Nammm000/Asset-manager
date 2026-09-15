package tech.getarrays.assetmanager.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import tech.getarrays.assetmanager.models.image.UserImage;

import java.util.Optional;

public interface UserImageRepo
        extends JpaRepository<UserImage, Long> {

    Optional<UserImage> findByUserId(Long userId);

    boolean existsByUserId(Long userId);
}