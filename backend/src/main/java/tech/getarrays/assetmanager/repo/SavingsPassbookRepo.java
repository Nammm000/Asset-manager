package tech.getarrays.assetmanager.repo;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tech.getarrays.assetmanager.models.SavingsPassbook;

import java.util.Optional;

@Repository
public interface SavingsPassbookRepo extends JpaRepository<SavingsPassbook, Long> {

    @Query("SELECT sp FROM SavingsPassbook sp WHERE sp.user.id = :userId ORDER BY COALESCE(sp.maturityDate, sp.withdrawalDate) DESC")
    Page<SavingsPassbook> findByUserId(@Param("userId") Long userId, Pageable pageable);

    Optional<SavingsPassbook> findFirstBySavingsPassbookNumberAndUserId(String savingsPassbookNumber, Long userId);
}
