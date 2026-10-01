package tech.getarrays.assetmanager.services.asset;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tech.getarrays.assetmanager.configuration.RequestSecurityContext;
import tech.getarrays.assetmanager.dto.PagedResponseDTO;
import tech.getarrays.assetmanager.dto.SavingsPassbookDTO;
import tech.getarrays.assetmanager.exception.NotFoundException;
import tech.getarrays.assetmanager.models.User;
import tech.getarrays.assetmanager.models.asset.SavingsPassbook;
import tech.getarrays.assetmanager.repo.SavingsPassbookRepo;
import tech.getarrays.assetmanager.repo.UserRepo;
import tech.getarrays.assetmanager.util.UserUtils;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SavingsPassbookServiceTest {

    private final RequestSecurityContext securityContext = new RequestSecurityContext();

    @BeforeEach
    void setUp() {
        securityContext.setUsername("test@example.com");
        // The public @Autowired constructor is the only way to install UserUtils' statics
        new UserUtils(userRepoReturning(User.builder().id(7L).email("test@example.com").build()),
                securityContext);
    }

    @AfterEach
    void tearDown() {
        new UserUtils(null, null);
    }

    @Test
    void listShortCircuitsToEmptyPageWhenBloomSaysUserHasNoPassbooks() {
        SavingsPassbookBloomFilter bloom = new SavingsPassbookBloomFilter(
                repoReturning(List.of(), List.of()), 1000, 0.01);
        bloom.rebuild();
        // null repos: touching the DB would NPE, which doubles as the "DB not consulted" proof
        SavingsPassbookService service = new SavingsPassbookService(null, null, bloom);

        PagedResponseDTO<SavingsPassbookDTO> result = service.getMySavingsPassbooks(2, 5);

        assertThat(result.getContent()).isEmpty();
        assertThat(result.getPage()).isEqualTo(2);
        assertThat(result.getSize()).isEqualTo(5);
        assertThat(result.getTotalElements()).isZero();
    }

    @Test
    void listResolvesCurrentUserBeforeBloomCheck() {
        new UserUtils(userRepoReturning(null), securityContext);
        SavingsPassbookService service = new SavingsPassbookService(null, null,
                new SavingsPassbookBloomFilter(null, 1000, 0.01)); // unbuilt -> all-pass

        assertThatThrownBy(() -> service.getMySavingsPassbooks(0, 10))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Authenticated user doesn't exist");
    }

    @Test
    void byIdThrowsNotFoundOnBloomMissWithoutDb() {
        SavingsPassbookBloomFilter bloom = new SavingsPassbookBloomFilter(
                repoReturning(List.of(1L), List.of(7L)), 100_000, 1e-6);
        bloom.rebuild();
        SavingsPassbookService service = new SavingsPassbookService(null, null, bloom);

        assertThatThrownBy(() -> service.getSavingsPassbook(999_999L))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Savings passbook id 999999 doesn't exist");
    }

    @Test
    void byIdPassesThroughToRepoWhenBloomUnbuilt() {
        SavingsPassbook passbook = new SavingsPassbook();
        passbook.setId(1L);
        passbook.setUser(User.builder().id(7L).email("test@example.com").build());
        SavingsPassbookRepo repo = repoWithHandler((proxy, method, args) -> switch (method.getName()) {
            case "findById" -> Optional.of(passbook);
            default -> throw new UnsupportedOperationException(method.getName());
        });
        SavingsPassbookService service = new SavingsPassbookService(repo, null,
                new SavingsPassbookBloomFilter(null, 1000, 0.01)); // unbuilt -> pass-through

        SavingsPassbookDTO dto = service.getSavingsPassbook(1L);

        assertThat(dto.getId()).isEqualTo(1L);
        assertThat(dto.getUserId()).isEqualTo(7L);
    }

    private static UserRepo userRepoReturning(User user) {
        return (UserRepo) Proxy.newProxyInstance(UserRepo.class.getClassLoader(),
                new Class<?>[]{UserRepo.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "findFirstByEmail" -> user;
                    default -> throw new UnsupportedOperationException(method.getName());
                });
    }

    private static SavingsPassbookRepo repoReturning(List<Long> passbookIds, List<Long> ownerUserIds) {
        return repoWithHandler((proxy, method, args) -> switch (method.getName()) {
            case "findAllPassbookIds" -> passbookIds;
            case "findDistinctOwnerUserIds" -> ownerUserIds;
            default -> throw new UnsupportedOperationException(method.getName());
        });
    }

    private static SavingsPassbookRepo repoWithHandler(InvocationHandler handler) {
        return (SavingsPassbookRepo) Proxy.newProxyInstance(
                SavingsPassbookRepo.class.getClassLoader(), new Class<?>[]{SavingsPassbookRepo.class}, handler);
    }
}
